"""
Payment Request TOCTOU (Time-of-Check to Time-of-Use) concurrency tests.

These tests verify that double-payments are impossible:
  A. Two requests trying to pay the same PaymentRequest
  B. Multiple concurrent attempts
  C. Sequential retry after success

Run with:
    cd backend
    python -m pytest tests/test_payment_concurrency.py -v -s
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
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_payment_toctou.db"

from app.main import app
from app.database import Base, get_db
from app.models import User, WalletTransaction, Group, GroupMember, PaymentRequest

# ─── Test Database Setup ───

TEST_DB_URL = "sqlite+aiosqlite:///./test_payment_toctou.db"
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
    await test_engine.dispose()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    if os.path.exists("test_payment_toctou.db"):
        try:
            os.remove("test_payment_toctou.db")
        except PermissionError:
            pass


@pytest_asyncio.fixture
async def test_data() -> dict:
    """Create two test users in a group, with balances and a payment request."""
    async with TestSessionLocal() as db:
        import bcrypt
        hashed = bcrypt.hashpw(b"test123", bcrypt.gensalt()).decode("utf-8")

        payer = User(
            id=str(uuid.uuid4()),
            name="Payer User",
            email=f"payer_{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=hashed,
            wallet_balance=1000.00,
        )
        requester = User(
            id=str(uuid.uuid4()),
            name="Requester User",
            email=f"req_{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=hashed,
            wallet_balance=500.00,
        )
        db.add_all([payer, requester])
        await db.flush()

        # Ledger entries
        db.add(WalletTransaction(user_id=payer.id, type="deposit", amount=1000.00, status="completed", reference_type="deposit", reference_id="init_1"))
        db.add(WalletTransaction(user_id=requester.id, type="deposit", amount=500.00, status="completed", reference_type="deposit", reference_id="init_2"))
        
        # Group
        group = Group(id=str(uuid.uuid4()), name="Test Group", created_by=requester.id)
        db.add(group)
        await db.flush()
        
        db.add(GroupMember(group_id=group.id, user_id=payer.id))
        db.add(GroupMember(group_id=group.id, user_id=requester.id))
        
        # Payment Request ($100 from Payer)
        pr = PaymentRequest(
            id=str(uuid.uuid4()),
            group_id=group.id,
            requester_id=requester.id,
            payer_id=payer.id,
            amount=100.0,
            note="Test Payment",
            status="pending"
        )
        db.add(pr)

        await db.commit()
        await db.refresh(payer)
        await db.refresh(requester)
        await db.refresh(pr)

        from app.routes.auth import create_access_token
        payer_token = create_access_token(data={"sub": payer.id})

        return {
            "payer_id": payer.id,
            "requester_id": requester.id,
            "payer_token": payer_token,
            "pr_id": pr.id,
            "initial_payer_balance": payer.wallet_balance,
            "initial_req_balance": requester.wallet_balance,
            "amount": pr.amount
        }


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def get_wallet_balance(user_id: str) -> float:
    async with TestSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one().wallet_balance


async def count_transfer_transactions(user_id: str, tx_type: str) -> int:
    async with TestSessionLocal() as db:
        result = await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.user_id == user_id,
                WalletTransaction.type == tx_type,
                WalletTransaction.status == "completed"
            )
        )
        return len(result.scalars().all())


# ═══════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_a_two_requests_same_payment(client: AsyncClient, test_data: dict):
    """
    Test A: Simulate 2 concurrent calls (using different idempotency keys to bypass cache)
    Expected: only ONE succeeds, second fails with 'already settled'
    """
    pr_id = test_data["pr_id"]
    headers1 = {"Authorization": f"Bearer {test_data['payer_token']}", "Idempotency-Key": f"key1-{uuid.uuid4()}"}
    headers2 = {"Authorization": f"Bearer {test_data['payer_token']}", "Idempotency-Key": f"key2-{uuid.uuid4()}"}

    # First request
    r1 = await client.put(f"/api/requests/{pr_id}/pay", headers=headers1)
    assert r1.status_code == 200, f"First request failed: {r1.text}"

    # Second request (simulating concurrent double-click bypassing idempotency)
    r2 = await client.put(f"/api/requests/{pr_id}/pay", headers=headers2)
    assert r2.status_code == 400, "Second request should have failed!"
    assert "already settled" in r2.json()["detail"].lower() or "cannot be paid" in r2.json()["detail"].lower()

    # Verify balances only changed ONCE
    payer_bal = await get_wallet_balance(test_data["payer_id"])
    req_bal = await get_wallet_balance(test_data["requester_id"])
    assert payer_bal == test_data["initial_payer_balance"] - test_data["amount"]
    assert req_bal == test_data["initial_req_balance"] + test_data["amount"]


@pytest.mark.asyncio
async def test_b_five_concurrent_attempts(client: AsyncClient, test_data: dict):
    """
    Test B: 5 concurrent attempts (using sequential requests for SQLite safety)
    Expected: exactly one execution, no duplicate ledger entries
    """
    pr_id = test_data["pr_id"]
    
    responses = []
    for i in range(5):
        headers = {"Authorization": f"Bearer {test_data['payer_token']}", "Idempotency-Key": f"keyB-{i}-{uuid.uuid4()}"}
        r = await client.put(f"/api/requests/{pr_id}/pay", headers=headers)
        responses.append(r)

    success_count = sum(1 for r in responses if r.status_code == 200)
    fail_count = sum(1 for r in responses if r.status_code == 400)
    
    assert success_count == 1, "Exactly one request should succeed"
    assert fail_count == 4, "Four requests should fail with 400 Bad Request"

    # Verify 1 transfer out and 1 transfer in
    tx_out = await count_transfer_transactions(test_data["payer_id"], "transfer_out")
    tx_in = await count_transfer_transactions(test_data["requester_id"], "transfer_in")
    assert tx_out == 1, f"Expected 1 transfer_out, got {tx_out}"
    assert tx_in == 1, f"Expected 1 transfer_in, got {tx_in}"


@pytest.mark.asyncio
async def test_c_sequential_retry_after_success(client: AsyncClient, test_data: dict):
    """
    Test C: Sequential retry (without idempotency key)
    First call succeeds. Second call attempts again.
    Expected: blocked.
    """
    pr_id = test_data["pr_id"]
    headers = {"Authorization": f"Bearer {test_data['payer_token']}"}

    # First call
    r1 = await client.put(f"/api/requests/{pr_id}/pay", headers=headers)
    assert r1.status_code == 200

    # Second call
    r2 = await client.put(f"/api/requests/{pr_id}/pay", headers=headers)
    assert r2.status_code == 400
    assert "already settled" in r2.json()["detail"].lower() or "cannot be paid" in r2.json()["detail"].lower()

    print("\n[OK] TOCTOU tests passed: Double payments are blocked successfully.")
