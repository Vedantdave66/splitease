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



