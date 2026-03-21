"""
Test Suite: Stripe Idempotency and External API Protection

Validates that:
1. Variable shadowing bug is fixed (Idempotency-Key reaches Stripe)
2. Normal decorators catch retries (Stripe is hit only once)
3. Simulated server crashes/network retries rely on Stripe's native idempotency

Run with:
    cd backend
    python -m pytest tests/test_stripe_idempotency.py -v -s
"""

import uuid
import pytest
import pytest_asyncio
from decimal import Decimal
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import os



from app.main import app
from app.database import Base, get_db
from app.models import User, ProviderAccount
from app.routes.auth import create_access_token

TEST_DB_URL = "sqlite+aiosqlite:///./test_stripe_idemp.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()
    if os.path.exists("test_stripe_idemp.db"):
        try:
            os.remove("test_stripe_idemp.db")
        except PermissionError:
            pass


@pytest.fixture
def mock_stripe_env():
    """Mock Stripe & Plaid API calls universally for these tests."""
    with patch("stripe.Customer.create") as mock_customer_create, \
         patch("stripe.PaymentIntent.create") as mock_pi_create, \
         patch("app.routes.stripe_routes.plaid_client.processor_stripe_bank_account_token_create") as mock_plaid:
        
        mock_plaid.return_value = {"stripe_bank_account_token": "tok_mock"}
        mock_customer_create.return_value = MagicMock(id="cus_mock")
        mock_pi_create.return_value = MagicMock(
            client_secret="pi_secret_mock",
            status="requires_action"
        )
        
        yield {
            "stripe_customer": mock_customer_create,
            "stripe_pi": mock_pi_create,
            "plaid": mock_plaid,
        }


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_a_retry_same_payment(client: AsyncClient, mock_stripe_env):
    """
    Test A — Retry same payment
    Simulate retry with same idempotency key.
    Expected: Stripe called once, our own @idempotent catches the second request.
    """
    async with TestSessionLocal() as db:
        payer = User(id=str(uuid.uuid4()), name="Payer", email="payer@test.com", hashed_password="pw")
        payee = User(id=str(uuid.uuid4()), name="Payee", email="payee@test.com", hashed_password="pw", stripe_account_id="acct_mock")
        db.add_all([payer, payee])
        await db.flush()

        provider = ProviderAccount(
            id=str(uuid.uuid4()),
            user_id=payer.id,
            access_token="access-sandbox-mock",
            account_id="acc-123",
            account_mask="1234",
            institution_name="Test Bank"
        )
        db.add(provider)
        await db.commit()

        # Login as payer
        token = create_access_token(data={"sub": payer.id})
        headers = {
            "Authorization": f"Bearer {token}",
            "Idempotency-Key": "test_key_A_123"
        }

        payload = {
            "amount": 50.00,
            "payee_id": payee.id,
            "provider_account_id": provider.id
        }

        # First request
        res1 = await client.post("/api/stripe/create-payment-intent", json=payload, headers=headers)
        assert res1.status_code == 200

        # Stripe should be called exactly once
        assert mock_stripe_env["stripe_pi"].call_count == 1
        
        # Verify the key was forwarded to Stripe
        call_kwargs = mock_stripe_env["stripe_pi"].call_args.kwargs
        assert call_kwargs.get("idempotency_key") == "test_key_A_123"

        # Second request (retry)
        res2 = await client.post("/api/stripe/create-payment-intent", json=payload, headers=headers)
        assert res2.status_code == 200

        # Stripe should STILL only be called once, because our decorator cached it!
        assert mock_stripe_env["stripe_pi"].call_count == 1


@pytest.mark.asyncio
async def test_b_missing_idempotency_key(client: AsyncClient, mock_stripe_env, capfd):
    """
    Test B — Missing idempotency key
    Expected: system logs warning, safe fallback behavior (succeeds without passing key to Stripe).
    """
    async with TestSessionLocal() as db:
        payer = User(id=str(uuid.uuid4()), name="Payer", email="payer2@test.com", hashed_password="pw")
        payee = User(id=str(uuid.uuid4()), name="Payee", email="payee2@test.com", hashed_password="pw", stripe_account_id="acct_mock")
        db.add_all([payer, payee])
        await db.flush()

        provider = ProviderAccount(
            id=str(uuid.uuid4()),
            user_id=payer.id,
            access_token="access-sandbox-mock",
            account_id="acc-123",
            account_mask="1234",
            institution_name="Test Bank"
        )
        db.add(provider)
        await db.commit()

        # Login as payer2
        token = create_access_token(data={"sub": payer.id})
        headers = {"Authorization": f"Bearer {token}"} # MISSING KEY

        payload = {
            "amount": 25.00,
            "payee_id": payee.id,
            "provider_account_id": provider.id
        }

        res = await client.post("/api/stripe/create-payment-intent", json=payload, headers=headers)
        assert res.status_code == 200

        # Verify warning was logged
        out, err = capfd.readouterr()
        assert "WARNING: Missing Idempotency-Key" in out

        # Verify Stripe was called WITHOUT idempotency key
        call_kwargs = mock_stripe_env["stripe_pi"].call_args.kwargs
        assert "idempotency_key" not in call_kwargs


@pytest.mark.asyncio
async def test_c_simulated_network_retry(client: AsyncClient, mock_stripe_env):
    """
    Test C — Simulated network retry
    Force our decorator to bypass cache (as if the DB rollback/server crashed), 
    meaning we call Stripe twice with the SAME Idempotency-Key.
    Stripe SDK should handle this because we properly pass the key!
    """
    import stripe
    from fastapi import HTTPException
    from sqlalchemy import select, delete
    from app.idempotency import IdempotencyKey

    async with TestSessionLocal() as db:
        payer = User(id=str(uuid.uuid4()), name="Payer", email="payer3@test.com", hashed_password="pw")
        payee = User(id=str(uuid.uuid4()), name="Payee", email="payee3@test.com", hashed_password="pw", stripe_account_id="acct_mock")
        db.add_all([payer, payee])
        await db.flush()

        provider = ProviderAccount(
            id=str(uuid.uuid4()),
            user_id=payer.id,
            access_token="access-sandbox-mock",
            account_id="acc-123",
            account_mask="1234",
            institution_name="Test Bank"
        )
        db.add(provider)
        await db.commit()

        # Login as payer3
        token = create_access_token(data={"sub": payer.id})
        headers = {
            "Authorization": f"Bearer {token}",
            "Idempotency-Key": "test_key_C_crash"
        }

        payload = {
            "amount": 100.00,
            "payee_id": payee.id,
            "provider_account_id": provider.id
        }

        # First call succeeds
        res_first = await client.post("/api/stripe/create-payment-intent", json=payload, headers=headers)
        assert res_first.status_code == 200
        
        # Stripe WAS hit exactly once
        assert mock_stripe_env["stripe_pi"].call_count == 1
        
        # Now, SIMULATE that the first call never saved to our DB cache (e.g. server crashed after Stripe)
        await db.execute(delete(IdempotencyKey).where(IdempotencyKey.key == "test_key_C_crash"))
        await db.commit()

        # Now, the user retries because their app got an error.
        res_retry = await client.post("/api/stripe/create-payment-intent", json=payload, headers=headers)
        assert res_retry.status_code == 200
        
        # Stripe is hit TWICE (because we bypassed/erased our local DB cache), 
        # BUT both calls have the SAME idempotency key sent to Stripe.
        assert mock_stripe_env["stripe_pi"].call_count == 2
        
        # Verify second call also passed the exact same key to Stripe
        call_kwargs = mock_stripe_env["stripe_pi"].call_args.kwargs
        assert call_kwargs.get("idempotency_key") == "test_key_C_crash"
        
        print("\nEnd-to-end safe! Stripe receives idempotency key even if local DB cache fails.")
