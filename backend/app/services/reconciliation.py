"""
Reconciliation service for verifying financial integrity.

Provides:
  - reconcile_all_wallets: compare every user's cached balance against ledger
  - auto_fix_balances: correct drifted balances
  - API endpoint: GET /api/admin/reconciliation
"""

import logging
from dataclasses import dataclass
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.ledger import compute_wallet_balance

logger = logging.getLogger("splitease.reconciliation")

router = APIRouter(prefix="/api/admin", tags=["admin"])


@dataclass
class ReconciliationResult:
    user_id: str
    user_email: str
    cached_balance: Decimal
    ledger_balance: Decimal
    difference: Decimal
    status: str  # "ok" | "discrepancy"


async def reconcile_all_wallets(db: AsyncSession) -> list[ReconciliationResult]:
    """
    Compare every user's cached wallet_balance against the ledger-derived balance.
    Returns a list of results — one per user.
    """
    result = await db.execute(select(User))
    users = result.scalars().all()

    results = []
    for user in users:
        ledger_balance = await compute_wallet_balance(user.id, db)
        cached_balance = Decimal(str(user.wallet_balance)).quantize(Decimal("0.01"))
        diff = cached_balance - ledger_balance

        status = "ok" if abs(diff) < Decimal("0.01") else "discrepancy"
        if status == "discrepancy":
            logger.warning(
                f"RECONCILIATION DISCREPANCY: user={user.id} ({user.email}) "
                f"cached={cached_balance} ledger={ledger_balance} diff={diff}"
            )

        results.append(ReconciliationResult(
            user_id=user.id,
            user_email=user.email,
            cached_balance=cached_balance,
            ledger_balance=ledger_balance,
            difference=diff,
            status=status,
        ))

    return results


async def auto_fix_balances(db: AsyncSession) -> list[ReconciliationResult]:
    """
    Find all balance discrepancies and correct the cached balance
    to match the ledger. Returns the list of corrected users.
    """
    all_results = await reconcile_all_wallets(db)
    fixed = []

    for r in all_results:
        if r.status == "discrepancy":
            # Load the user and fix
            user_result = await db.execute(
                select(User).where(User.id == r.user_id)
            )
            user = user_result.scalar_one()
            old_balance = user.wallet_balance
            user.wallet_balance = r.ledger_balance
            logger.info(
                f"AUTO-FIX: user={user.id} ({user.email}) "
                f"old_cached={old_balance} → new_cached={r.ledger_balance}"
            )
            fixed.append(r)

    if fixed:
        await db.commit()

    return fixed


@router.get("/reconciliation")
async def run_reconciliation(db: AsyncSession = Depends(get_db)):
    """
    Run a full reconciliation check across all user wallets.
    Returns each user's cached vs ledger balance and any discrepancies.
    """
    results = await reconcile_all_wallets(db)
    discrepancies = [r for r in results if r.status == "discrepancy"]

    return {
        "total_users": len(results),
        "discrepancies_found": len(discrepancies),
        "results": [
            {
                "user_id": r.user_id,
                "user_email": r.user_email,
                "cached_balance": r.cached_balance,
                "ledger_balance": r.ledger_balance,
                "difference": r.difference,
                "status": r.status,
            }
            for r in results
        ],
    }


@router.post("/reconciliation/fix")
async def fix_reconciliation(db: AsyncSession = Depends(get_db)):
    """
    Auto-fix any balance discrepancies by setting cached balance = ledger balance.
    USE WITH CAUTION — this modifies user balances.
    """
    fixed = await auto_fix_balances(db)
    return {
        "fixed_count": len(fixed),
        "fixed_users": [
            {
                "user_id": r.user_id,
                "user_email": r.user_email,
                "old_cached": r.cached_balance,
                "corrected_to": r.ledger_balance,
            }
            for r in fixed
        ],
    }
