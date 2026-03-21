"""
Ledger utilities for financial correctness.

Production-grade guarantees:
  - compute_wallet_balance: derive balance from completed transactions (single source of truth)
  - pre_validate_balance: assert ledger consistency BEFORE any mutation
  - validate_balance_integrity: assert cached balance matches ledger AFTER mutation
  - verify_post_commit: read-only post-commit check — logs critical error, NEVER auto-fixes
  - assert_conservation_of_money: verify total money is preserved across a transfer
  - lock_user_for_update: pessimistic row-level lock on a User row
  - lock_users_sorted: lock multiple users in deterministic order to prevent deadlocks
"""

import logging
from decimal import Decimal
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, WalletTransaction

logger = logging.getLogger("splitease.ledger")


async def compute_wallet_balance(user_id: str, db: AsyncSession) -> Decimal:
    """
    Compute the wallet balance by summing all completed WalletTransactions.
    This is the single source of truth — the `wallet_balance` column is a cache.
    """
    result = await db.execute(
        select(sa_func.coalesce(sa_func.sum(WalletTransaction.amount), 0.0)).where(
            WalletTransaction.user_id == user_id,
            WalletTransaction.status == "completed",
        )
    )
    # Ensure precision conversion from float/int coming out of SQLite/Postgres
    val = result.scalar_one()
    # If using string cast to avoid float repr drift
    return Decimal(str(val)).quantize(Decimal("0.01"))


async def pre_validate_balance(user: User, db: AsyncSession, correlation_id: str = "") -> None:
    """
    Assert that the cached `wallet_balance` matches the ledger sum BEFORE any mutation.
    This catches pre-existing corruption before we proceed.

    MUST be called BEFORE any writes in the transaction.
    Raises ValueError if the balance is already inconsistent.
    """
    ledger_balance = await compute_wallet_balance(user.id, db)
    # user.wallet_balance could be a float due to SQLite, so parse as str securely
    cached_balance = Decimal(str(user.wallet_balance)).quantize(Decimal("0.01"))

    if abs(cached_balance - ledger_balance) > Decimal("0.01"):
        msg = (
            f"[{correlation_id}] PRE-VALIDATION FAILURE for user {user.id}: "
            f"cached={cached_balance}, ledger={ledger_balance}, "
            f"diff={cached_balance - ledger_balance}. "
            f"REFUSING to proceed with mutation — existing data is corrupt."
        )
        logger.critical(msg)
        raise ValueError(msg)


async def validate_balance_integrity(user: User, db: AsyncSession, correlation_id: str = "") -> None:
    """
    Assert that the cached `wallet_balance` matches the ledger sum AFTER mutation.
    Called after flush but before commit.

    Raises ValueError if there is a discrepancy (triggers rollback).
    """
    ledger_balance = await compute_wallet_balance(user.id, db)
    cached_balance = Decimal(str(user.wallet_balance)).quantize(Decimal("0.01"))

    if abs(cached_balance - ledger_balance) > Decimal("0.01"):
        msg = (
            f"[{correlation_id}] POST-MUTATION INTEGRITY FAILURE for user {user.id}: "
            f"cached={cached_balance}, ledger={ledger_balance}, "
            f"diff={cached_balance - ledger_balance}"
        )
        logger.critical(msg)
        raise ValueError(msg)


def assert_conservation_of_money(
    payer_balance_before: Decimal,
    payer_balance_after: Decimal,
    payee_balance_before: Decimal,
    payee_balance_after: Decimal,
    amount: Decimal,
    correlation_id: str = "",
) -> None:
    """
    Verify the conservation-of-money invariant:
      total_before == total_after (no money created or destroyed)
      payer lost exactly `amount`, payee gained exactly `amount`

    Raises ValueError on violation (triggers rollback).
    """
    total_before = payer_balance_before + payee_balance_before
    total_after = payer_balance_after + payee_balance_after

    if abs(total_before - total_after) > Decimal("0.01"):
        msg = (
            f"[{correlation_id}] CONSERVATION OF MONEY VIOLATION: "
            f"total_before={total_before}, total_after={total_after}, "
            f"diff={total_before - total_after}"
        )
        logger.critical(msg)
        raise ValueError(msg)

    payer_delta = payer_balance_before - payer_balance_after
    payee_delta = payee_balance_after - payee_balance_before

    if abs(payer_delta - amount) > Decimal("0.01") or abs(payee_delta - amount) > Decimal("0.01"):
        msg = (
            f"[{correlation_id}] TRANSFER AMOUNT MISMATCH: "
            f"expected={amount}, payer_delta={payer_delta}, payee_delta={payee_delta}"
        )
        logger.critical(msg)
        raise ValueError(msg)


async def verify_post_commit(user_id: str, expected_balance: Decimal, db: AsyncSession, correlation_id: str = "") -> None:
    """
    Read-only post-commit verification. Called AFTER commit with a fresh query.
    
    Logs a CRITICAL error if mismatch but NEVER auto-fixes.
    This is a safety net — if this fires, there is a bug in the transaction logic.
    """
    ledger_balance = await compute_wallet_balance(user_id, db)

    if abs(expected_balance - ledger_balance) > Decimal("0.01"):
        logger.critical(
            f"[{correlation_id}] POST-COMMIT VERIFICATION FAILED for user {user_id}: "
            f"expected={expected_balance}, actual_ledger={ledger_balance}, "
            f"diff={expected_balance - ledger_balance}. "
            f"THIS IS A BUG — investigate immediately. No auto-fix applied."
        )


async def lock_user_for_update(user_id: str, db: AsyncSession) -> User:
    """
    Acquire a pessimistic row-level lock on the User row.

    On PostgreSQL: uses SELECT ... FOR UPDATE (blocks concurrent transactions).
    On SQLite: FOR UPDATE is a no-op, but SQLite's serialized writes provide
    equivalent safety for single-writer scenarios.
    """
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError(f"User {user_id} not found")
    return user


async def lock_users_sorted(user_ids: list[str], db: AsyncSession) -> dict[str, User]:
    """
    Lock multiple users in deterministic sorted order to prevent deadlocks.
    Returns a dict mapping user_id → locked User object.
    """
    locked = {}
    for uid in sorted(user_ids):
        locked[uid] = await lock_user_for_update(uid, db)
    return locked
