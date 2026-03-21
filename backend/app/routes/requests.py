"""
Payment Request routes — create, list, and pay peer-to-peer requests.

Production-grade financial safety for pay_request_with_wallet:
  1. Idempotency check (request body hashed)
  2. Load + validate request state
  3. Lock users (deterministic sorted order — prevents deadlocks)
  4. Pre-validate: both users' cached balances == ledger
  5. Create PENDING double-entry ledger transactions
  6. Compute new balances (in memory)
  7. Conservation-of-money invariant check
  8. Atomic write: mark completed + update caches + update request status
  9. Post-commit verification (read-only, never auto-fixes)
"""

import datetime
import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import PaymentRequest, User, GroupMember, Notification, WalletTransaction
from app.routes.auth import get_current_user
from app.schemas import PaymentRequestCreate, PaymentRequestOut
from app.idempotency import idempotent
from app.ledger import (
    lock_users_sorted,
    pre_validate_balance,
    validate_balance_integrity,
    assert_conservation_of_money,
    verify_post_commit,
)

logger = logging.getLogger("splitease.requests")

router = APIRouter(prefix="/api", tags=["Payment Requests"])


def _build_payment_request_out(pr: PaymentRequest) -> PaymentRequestOut:
    """Helper to build PaymentRequestOut from a loaded PaymentRequest with relationships."""
    return PaymentRequestOut(
        **pr.__dict__,
        requester_name=pr.requester.name,
        requester_avatar=pr.requester.avatar_color,
        payer_name=pr.payer.name,
        payer_avatar=pr.payer.avatar_color,
    )


@router.post("/groups/{group_id}/requests", response_model=PaymentRequestOut)
@idempotent
async def create_payment_request(
    group_id: str,
    data: PaymentRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a direct peer-to-peer payment request within a group."""
    # Verify group membership for both
    result = await db.execute(
        select(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id.in_([current_user.id, data.payer_id]),
        )
    )
    members = result.scalars().all()
    if len(members) != 2:
        raise HTTPException(status_code=400, detail="Invalid group members for request")

    new_request = PaymentRequest(
        group_id=group_id,
        requester_id=current_user.id,
        payer_id=data.payer_id,
        amount=data.amount,
        note=data.note,
        due_date=data.due_date,
        status="pending",
    )
    db.add(new_request)

    notification = Notification(
        user_id=data.payer_id,
        type="payment_request_received",
        title="New Payment Request",
        message=f"{current_user.name} requested ${data.amount:.2f}",
        reference_id=new_request.id,
        group_id=group_id,
    )
    db.add(notification)

    await db.flush()
    await db.refresh(new_request)

    result = await db.execute(
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requester),
            selectinload(PaymentRequest.payer),
        )
        .filter(PaymentRequest.id == new_request.id)
    )
    reloaded = result.scalars().first()
    return _build_payment_request_out(reloaded)


@router.get("/groups/{group_id}/requests", response_model=list[PaymentRequestOut])
async def get_group_requests(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves all requests in a group for the current user."""
    result = await db.execute(
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requester),
            selectinload(PaymentRequest.payer),
        )
        .filter(
            PaymentRequest.group_id == group_id,
            (PaymentRequest.requester_id == current_user.id)
            | (PaymentRequest.payer_id == current_user.id),
        )
        .order_by(PaymentRequest.created_at.desc())
    )
    return [_build_payment_request_out(r) for r in result.scalars().all()]


@router.put("/requests/{request_id}/pay", response_model=PaymentRequestOut)
@idempotent
async def pay_request_with_wallet(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Settle a payment request using internal wallet balance.
    Full 9-step production-safe flow.
    """
    correlation_id = (request.headers.get("Idempotency-Key") or "no-key")[:12]

    # ═══════════════════════════════════════════════════════════
    # STEP 1: Idempotency check (handled by @idempotent decorator)
    # ═══════════════════════════════════════════════════════════

    # ═══════════════════════════════════════════════════════════
    # STEP 2: Load + validate request state (NO writes yet)
    # ═══════════════════════════════════════════════════════════
    result = await db.execute(
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requester),
            selectinload(PaymentRequest.payer),
        )
        .filter(
            PaymentRequest.id == request_id,
            PaymentRequest.payer_id == current_user.id,
        )
    )
    pr = result.scalars().first()

    if not pr:
        raise HTTPException(
            status_code=404, detail="Request not found or you are not the payer"
        )

    if pr.status in ["settled", "completed", "cancelled"]:
        raise HTTPException(
            status_code=400, detail="Request cannot be paid in its current state"
        )

    logger.info(
        f"[{correlation_id}] pay_request: payer={current_user.id} "
        f"requester={pr.requester_id} amount={pr.amount} request_id={request_id}"
    )

    # ═══════════════════════════════════════════════════════════
    # STEP 3: Lock users (deterministic sorted order)
    # MUST be done before writing or locking the request
    # ═══════════════════════════════════════════════════════════
    locked = await lock_users_sorted([current_user.id, pr.requester_id], db)
    payer = locked[current_user.id]
    requester = locked[pr.requester_id]

    # ═══════════════════════════════════════════════════════════
    # STEP 3.5: Re-fetch request with FOR UPDATE (TOCTOU protection)
    # ═══════════════════════════════════════════════════════════
    result = await db.execute(
        select(PaymentRequest)
        .where(PaymentRequest.id == request_id)
        .with_for_update()
    )
    locked_pr = result.scalar_one_or_none()
    if not locked_pr or locked_pr.status in ["settled", "completed", "cancelled"]:
        raise HTTPException(
            status_code=400, detail="Request already settled or cancelled"
        )
    # Use the locked instance for mutations
    pr = locked_pr

    # ═══════════════════════════════════════════════════════════
    # STEP 4: Pre-validate ledger + balances (BEFORE any writes)
    # ═══════════════════════════════════════════════════════════
    await pre_validate_balance(payer, db, correlation_id)
    await pre_validate_balance(requester, db, correlation_id)

    # Sufficient funds check (AFTER lock + pre-validation)
    if payer.wallet_balance < pr.amount:
        logger.info(
            f"[{correlation_id}] Insufficient balance: "
            f"payer_balance={payer.wallet_balance}, needed={pr.amount}"
        )
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # Record pre-mutation balances for conservation check
    payer_balance_before = Decimal(str(payer.wallet_balance)).quantize(Decimal("0.01"))
    requester_balance_before = Decimal(str(requester.wallet_balance)).quantize(Decimal("0.01"))

    # ═══════════════════════════════════════════════════════════
    # STEP 5: Create PENDING double-entry ledger transactions
    # ═══════════════════════════════════════════════════════════
    now = datetime.datetime.now(datetime.timezone.utc)

    tx_out = WalletTransaction(
        user_id=payer.id,
        type="transfer_out",
        amount=-pr.amount,
        status="pending",
        reference_type="payment_request",
        reference_id=pr.id,
    )
    tx_in = WalletTransaction(
        user_id=requester.id,
        type="transfer_in",
        amount=pr.amount,
        status="pending",
        reference_type="payment_request",
        reference_id=pr.id,
    )
    db.add(tx_out)
    db.add(tx_in)

    # ═══════════════════════════════════════════════════════════
    # STEP 6: Compute new balances (in memory, not written yet)
    # ═══════════════════════════════════════════════════════════
    payer_balance_after = payer_balance_before - pr.amount
    requester_balance_after = requester_balance_before + pr.amount

    # Negative balance guard
    if payer_balance_after < Decimal("-0.01"):
        logger.critical(
            f"[{correlation_id}] NEGATIVE BALANCE would result: "
            f"payer={payer.id} before={payer_balance_before} after={payer_balance_after}"
        )
        raise HTTPException(status_code=500, detail="Internal error: balance invariant violated")

    # ═══════════════════════════════════════════════════════════
    # STEP 7: Conservation-of-money invariant check
    # ═══════════════════════════════════════════════════════════
    assert_conservation_of_money(
        payer_balance_before=payer_balance_before,
        payer_balance_after=payer_balance_after,
        payee_balance_before=requester_balance_before,
        payee_balance_after=requester_balance_after,
        amount=pr.amount,
        correlation_id=correlation_id,
    )

    # ═══════════════════════════════════════════════════════════
    # STEP 8: Atomic write — mark completed + update caches
    # ═══════════════════════════════════════════════════════════
    # Promote transactions from pending → completed
    tx_out.status = "completed"
    tx_out.completed_at = now
    tx_in.status = "completed"
    tx_in.completed_at = now

    # Update cached balances
    payer.wallet_balance = payer_balance_after
    requester.wallet_balance = requester_balance_after

    # Update request status
    pr.status = "settled"

    # Notification
    notification = Notification(
        user_id=requester.id,
        type="payment_received",
        title="Payment Received!",
        message=f"{payer.name} paid your request for ${pr.amount:.2f}",
        reference_id=pr.id,
        group_id=pr.group_id,
    )
    db.add(notification)

    # Flush all writes within the single transaction
    await db.flush()

    # Post-mutation integrity check (raises ValueError → rollback on failure)
    await validate_balance_integrity(payer, db, correlation_id)
    await validate_balance_integrity(requester, db, correlation_id)

    logger.info(
        f"[{correlation_id}] pay_request SUCCESS: "
        f"payer={payer.id} ({payer_balance_before}→{payer_balance_after}) "
        f"requester={requester.id} ({requester_balance_before}→{requester_balance_after}) "
        f"amount={pr.amount}"
    )

    # ═══════════════════════════════════════════════════════════
    # STEP 9: Post-commit verification is handled by the session
    # commit in get_db. For true post-commit checks, use the
    # reconciliation endpoint: GET /api/admin/reconciliation
    # ═══════════════════════════════════════════════════════════

    # Reload for response
    result = await db.execute(
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requester),
            selectinload(PaymentRequest.payer),
        )
        .filter(PaymentRequest.id == pr.id)
    )
    refreshed = result.scalars().first()
    return _build_payment_request_out(refreshed)
