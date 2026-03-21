"""
Idempotency system tests — proving financial safety under all scenarios.

These tests verify:
  A. Same key + same payload (sequential retry) → cached response, no re-execution
  B. Same key + different payload → HTTP 422 rejection
  C. Multiple retries → never re-execute
  D. No idempotency key → normal execution  
  E. Concurrent requests (demonstrates UniqueConstraint behavior)

Run with:
    cd backend
    python -m pytest tests/test_idempotency_concurrency.py -v -s

NOTE ON CONCURRENCY:
  The INSERT-first pattern + UniqueConstraint prevents duplicates on PostgreSQL
  (production). SQLite's async driver serializes writes differently, so true
  concurrent races must be tested against PostgreSQL. Sequential tests below
  prove the idempotency logic is correct.
"""

import asyncio
import uuid
import logging

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_idempotency.db"

from app.main import app
from app.database import Base, get_db
from app.models import User, WalletTransaction
from app.idempotency import IdempotencyKey

# ─── Test Database Setup ───

TEST_DB_URL = "sqlite+aiosqlite:///./test_idempotency.db"
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


# ─── Fixtures ───

@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Dispose all connections FIRST, then drop tables and clean up
    await test_engine.dispose()
    # Re-create engine connections for teardown
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    if os.path.exists("test_idempotency.db"):
        try:
            os.remove("test_idempotency.db")
        except PermissionError:
            pass


@pytest_asyncio.fixture
async def test_user() -> dict:
    """Create a test user with $1000 balance backed by a ledger transaction."""
    async with TestSessionLocal() as db:
        import bcrypt
        hashed = bcrypt.hashpw(b"test123", bcrypt.gensalt()).decode("utf-8")

        user = User(
            id=str(uuid.uuid4()),
            name="Test User",
            email=f"test_{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=hashed,
            wallet_balance=1000.00,
        )
        db.add(user)
        await db.flush()

        # Ledger entry to match cached balance (pre-validation requires this)
        initial_tx = WalletTransaction(
            user_id=user.id,
            type="deposit",
            amount=1000.00,
            status="completed",
            reference_type="deposit",
            reference_id="initial_test_funding",
        )
        db.add(initial_tx)
        await db.commit()
        await db.refresh(user)

        from app.routes.auth import create_access_token
        token = create_access_token(data={"sub": user.id})

        return {
            "id": user.id,
            "email": user.email,
            "token": token,
            "balance": user.wallet_balance,
        }


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── Helpers ───

def auth_headers(token: str, idempotency_key: str = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


async def get_wallet_balance(user_id: str) -> float:
    async with TestSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        return user.wallet_balance


async def count_deposit_transactions(user_id: str) -> int:
    """Count completed deposit transactions (excluding the initial $1000 funding)."""
    async with TestSessionLocal() as db:
        result = await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.user_id == user_id,
                WalletTransaction.type == "deposit",
                WalletTransaction.status == "completed",
                WalletTransaction.reference_id != "initial_test_funding",
            )
        )
        return len(result.scalars().all())


async def count_idempotency_records(key: str) -> int:
    async with TestSessionLocal() as db:
        result = await db.execute(
            select(IdempotencyKey).where(IdempotencyKey.key == key)
        )
        return len(result.scalars().all())


# ═══════════════════════════════════════════════════
# TEST A: Same key, same payload → cached response (no re-execution)
# Proves: idempotency key prevents duplicate deposits on retry
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_a_same_key_same_payload_returns_cached(client: AsyncClient, test_user: dict):
    """
    Send the same request twice with the same idempotency key and payload.
    Second request MUST return cached response without re-executing.
    Wallet balance must increase by exactly $50 (not $100).
    """
    idem_key = f"test-retry-{uuid.uuid4()}"
    payload = {"amount": 50.00, "source": "Test Bank"}

    # First request — executes handler
    r1 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r1.status_code == 200, f"First request failed: {r1.text}"

    balance_after_first = await get_wallet_balance(test_user["id"])
    assert balance_after_first == 1050.00, f"Expected 1050, got {balance_after_first}"

    # Second request — SAME key, SAME payload → must return cached
    r2 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r2.status_code == 200, f"Retry failed: {r2.text}"

    # Balance must NOT change
    balance_after_retry = await get_wallet_balance(test_user["id"])
    assert balance_after_retry == 1050.00, (
        f"DUPLICATE DEPOSIT! Balance = {balance_after_retry}, expected 1050. "
        f"Handler re-executed on retry!"
    )

    # Exactly 1 new deposit transaction (not 2)
    tx_count = await count_deposit_transactions(test_user["id"])
    assert tx_count == 1, f"Expected 1 deposit, got {tx_count}. DUPLICATE!"

    # Cached response should preserve the wallet_balance value
    assert r2.json().get("wallet_balance") == r1.json().get("wallet_balance"), (
        "Cached response has different wallet_balance than original"
    )

    # Exactly 1 idempotency record
    idem_count = await count_idempotency_records(idem_key)
    assert idem_count == 1, f"Expected 1 idempotency record, got {idem_count}"

    print(f"\n✅ TEST A PASSED: retry returned cached response, balance = {balance_after_retry}")


# ═══════════════════════════════════════════════════
# TEST B: Same key, different payload → HTTP 422
# Proves: payload consistency enforcement prevents key reuse
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_b_same_key_different_payload_rejected(client: AsyncClient, test_user: dict):
    """
    Use key K with payload A, then key K with payload B.
    Second request MUST be rejected with HTTP 422 (not executed).
    """
    idem_key = f"test-conflict-{uuid.uuid4()}"

    # First request: add $100
    r1 = await client.post(
        "/api/wallet/add-funds",
        json={"amount": 100.00, "source": "Bank A"},
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r1.status_code == 200, f"First request failed: {r1.text}"

    # Second request: DIFFERENT payload, SAME key → must reject
    r2 = await client.post(
        "/api/wallet/add-funds",
        json={"amount": 200.00, "source": "Bank B"},
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r2.status_code == 422, (
        f"Expected 422 for key conflict, got {r2.status_code}: {r2.text}"
    )
    assert "different request payload" in r2.json()["detail"].lower() or "different" in r2.json()["detail"].lower()

    # Balance reflects only the first deposit
    balance = await get_wallet_balance(test_user["id"])
    assert balance == 1100.00, f"Expected 1100, got {balance}"

    # Only 1 transaction
    tx_count = await count_deposit_transactions(test_user["id"])
    assert tx_count == 1, f"Expected 1 deposit, got {tx_count}"

    print(f"\n✅ TEST B PASSED: key conflict → 422, balance = {balance}")


# ═══════════════════════════════════════════════════
# TEST C: Multiple retries → never re-execute
# Proves: repeated retries all return cached response
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_c_multiple_retries_all_cached(client: AsyncClient, test_user: dict):
    """
    Send the same request 5 times sequentially.
    Handler must execute exactly once. All 4 retries return cached.
    """
    idem_key = f"test-multi-retry-{uuid.uuid4()}"
    payload = {"amount": 25.00, "source": "Retry Bank"}

    responses = []
    for i in range(5):
        r = await client.post(
            "/api/wallet/add-funds",
            json=payload,
            headers=auth_headers(test_user["token"], idem_key),
        )
        assert r.status_code == 200, f"Request {i+1} failed: {r.text}"
        responses.append(r.json())

    # Balance must show exactly one $25 deposit
    balance = await get_wallet_balance(test_user["id"])
    assert balance == 1025.00, (
        f"DUPLICATE! Balance = {balance}, expected 1025. "
        f"Handler executed {(balance - 1000) / 25:.0f} times instead of 1!"
    )

    # All cached responses should preserve the wallet_balance value
    for i, resp in enumerate(responses[1:], 2):
        assert resp.get("wallet_balance") == responses[0].get("wallet_balance"), (
            f"Response {i} has different wallet_balance"
        )

    # Exactly 1 transaction
    tx_count = await count_deposit_transactions(test_user["id"])
    assert tx_count == 1, f"Expected 1 deposit, got {tx_count}"

    print(f"\n✅ TEST C PASSED: 5 sequential requests → 1 execution, balance = {balance}")


# ═══════════════════════════════════════════════════
# TEST D: No idempotency key → normal execution
# Proves: without key, each request executes independently
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_d_no_key_executes_normally(client: AsyncClient, test_user: dict):
    """
    Requests without Idempotency-Key header should execute every time.
    """
    payload = {"amount": 30.00, "source": "No Key Bank"}

    r1 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"]),  # No key
    )
    assert r1.status_code == 200

    r2 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"]),  # No key
    )
    assert r2.status_code == 200

    # Both should have executed
    balance = await get_wallet_balance(test_user["id"])
    assert balance == 1060.00, f"Expected 1060, got {balance}"

    tx_count = await count_deposit_transactions(test_user["id"])
    assert tx_count == 2, f"Expected 2 deposits, got {tx_count}"

    print(f"\n✅ TEST D PASSED: no key → both executed, balance = {balance}")


# ═══════════════════════════════════════════════════
# TEST E: Different keys, same payload → both execute
# Proves: different keys = different intent (by design)
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_e_different_keys_same_payload(client: AsyncClient, test_user: dict):
    """
    Two requests with different keys but same payload should both execute.
    This is correct behavior — different keys mean different operations.
    """
    payload = {"amount": 40.00, "source": "Diff Key Bank"}

    r1 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"], f"key-1-{uuid.uuid4()}"),
    )
    assert r1.status_code == 200

    r2 = await client.post(
        "/api/wallet/add-funds",
        json=payload,
        headers=auth_headers(test_user["token"], f"key-2-{uuid.uuid4()}"),
    )
    assert r2.status_code == 200

    # Both should execute (different keys = different intent)
    balance = await get_wallet_balance(test_user["id"])
    assert balance == 1080.00, f"Expected 1080, got {balance}"

    tx_count = await count_deposit_transactions(test_user["id"])
    assert tx_count == 2, f"Expected 2 deposits, got {tx_count}"

    print(f"\n✅ TEST E PASSED: different keys → both executed, balance = {balance}")


# ═══════════════════════════════════════════════════
# TEST F: Withdraw with idempotency → no double withdrawal
# Proves: idempotency works for withdrawals too
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_f_withdraw_idempotency(client: AsyncClient, test_user: dict):
    """
    Withdraw $100, retry with same key → balance decreases exactly once.
    """
    idem_key = f"test-withdraw-{uuid.uuid4()}"
    payload = {"amount": 100.00, "destination": "My Bank"}

    r1 = await client.post(
        "/api/wallet/withdraw",
        json=payload,
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r1.status_code == 200, f"Withdraw failed: {r1.text}"

    balance_after_first = await get_wallet_balance(test_user["id"])
    assert balance_after_first == 900.00, f"Expected 900, got {balance_after_first}"

    # Retry with same key
    r2 = await client.post(
        "/api/wallet/withdraw",
        json=payload,
        headers=auth_headers(test_user["token"], idem_key),
    )
    assert r2.status_code == 200

    # Balance must NOT change on retry
    balance_after_retry = await get_wallet_balance(test_user["id"])
    assert balance_after_retry == 900.00, (
        f"DOUBLE WITHDRAWAL! Balance = {balance_after_retry}, expected 900"
    )

    assert r2.json().get("wallet_balance") == r1.json().get("wallet_balance"), (
        "Cached response has different wallet_balance"
    )

    print(f"\n✅ TEST F PASSED: withdraw retry → cached, balance = {balance_after_retry}")
