from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Group, GroupMember, SettlementRecord, Notification
from app.schemas import SettlementRecordCreate, SettlementRecordOut, SettlementStatusUpdate
from app.routes.auth import get_current_user
from app.idempotency import idempotent

router = APIRouter(prefix="/api/groups/{group_id}/settlement-records", tags=["settlement-records"])


async def _verify_membership(group_id: str, user_id: str, db: AsyncSession) -> Group:
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    is_member = any(m.user_id == user_id for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return group


def _build_settlement_out(record: SettlementRecord, payer: User, payee: User) -> SettlementRecordOut:
    payer_email_to_use = payer.interac_email if payer.interac_email else payer.email
    payee_email_to_use = payee.interac_email if payee.interac_email else payee.email

    return SettlementRecordOut(
        id=record.id,
        group_id=record.group_id,
        payer_id=payer.id,
        payer_name=payer.name,
        payer_email=payer_email_to_use,
        payer_avatar_color=payer.avatar_color,
        payee_id=payee.id,
        payee_name=payee.name,
        payee_email=payee_email_to_use,
        payee_avatar_color=payee.avatar_color,
        amount=record.amount,
        method=record.method,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _create_notification(user_id: str, ntype: str, title: str, message: str, group_id: str, reference_id: str | None = None) -> Notification:
    return Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        message=message,
        group_id=group_id,
        reference_id=reference_id,
    )


@router.post("", response_model=SettlementRecordOut)
@idempotent
async def create_settlement(
    group_id: str,
    data: SettlementRecordCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a settlement — payer starts the process."""
    group = await _verify_membership(group_id, current_user.id, db)

    # Verify payee is a member
    member_ids = {m.user_id for m in group.members}
    if data.payee_id not in member_ids:
        raise HTTPException(status_code=400, detail="Payee is not a group member")

    if data.payee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot settle with yourself")

    # Create the record
    record = SettlementRecord(
        group_id=group_id,
        payer_id=current_user.id,
        payee_id=data.payee_id,
        amount=data.amount,
        method=data.method,
        status="pending",
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Get payee user for notification + output
    payee_result = await db.execute(select(User).where(User.id == data.payee_id))
    payee = payee_result.scalar_one()

    # Notify the payee
    notif = _create_notification(
        user_id=payee.id,
        ntype="settlement_requested",
        title="Settlement Requested",
        message=f"{current_user.name} wants to send you ${data.amount:.2f} via {data.method.replace('_', '-')}",
        group_id=group_id,
        reference_id=record.id,
    )
    db.add(notif)
    await db.flush()

    return _build_settlement_out(record, current_user, payee)


@router.get("", response_model=list[SettlementRecordOut])
async def list_settlements(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all settlement records for a group."""
    await _verify_membership(group_id, current_user.id, db)

    result = await db.execute(
        select(SettlementRecord)
        .where(SettlementRecord.group_id == group_id)
        .order_by(SettlementRecord.created_at.desc())
    )
    records = result.scalars().all()

    out = []
    for r in records:
        payer_q = await db.execute(select(User).where(User.id == r.payer_id))
        payee_q = await db.execute(select(User).where(User.id == r.payee_id))
        payer = payer_q.scalar_one()
        payee = payee_q.scalar_one()
        out.append(_build_settlement_out(r, payer, payee))

    return out


@router.put("/{settlement_id}/status", response_model=SettlementRecordOut)
@idempotent
async def update_settlement_status(
    group_id: str,
    settlement_id: str,
    data: SettlementStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the status of a settlement record.
    
    - Payer can update: pending -> sent
    - Payee can update: sent -> settled or sent -> declined
    """
    await _verify_membership(group_id, current_user.id, db)

    result = await db.execute(
        select(SettlementRecord).where(
            SettlementRecord.id == settlement_id,
            SettlementRecord.group_id == group_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Settlement not found")

    # Authorization checks
    valid_transitions = {
        # payer actions
        ("pending", "sent"): record.payer_id,
        # payee actions
        ("sent", "settled"): record.payee_id,
        ("sent", "declined"): record.payee_id,
    }

    transition = (record.status, data.status)
    allowed_user = valid_transitions.get(transition)
    if allowed_user is None:
        raise HTTPException(status_code=400, detail=f"Invalid status transition: {record.status} → {data.status}")
    if allowed_user != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized for this action")

    record.status = data.status
    await db.flush()
    await db.refresh(record)

    # Get both users for output
    payer_q = await db.execute(select(User).where(User.id == record.payer_id))
    payee_q = await db.execute(select(User).where(User.id == record.payee_id))
    payer = payer_q.scalar_one()
    payee = payee_q.scalar_one()

    # Send notification based on transition
    if data.status == "sent":
        notif = _create_notification(
            user_id=payee.id,
            ntype="payment_sent",
            title="Payment Sent",
            message=f"{payer.name} marked ${record.amount:.2f} as sent. Please confirm when received.",
            group_id=group_id,
            reference_id=record.id,
        )
        db.add(notif)
    elif data.status == "settled":
        notif = _create_notification(
            user_id=payer.id,
            ntype="payment_confirmed",
            title="Payment Confirmed",
            message=f"{payee.name} confirmed receiving ${record.amount:.2f}. Debt settled!",
            group_id=group_id,
            reference_id=record.id,
        )
        db.add(notif)
    elif data.status == "declined":
        notif = _create_notification(
            user_id=payer.id,
            ntype="payment_declined",
            title="Payment Not Received",
            message=f"{payee.name} has not received your ${record.amount:.2f} payment yet.",
            group_id=group_id,
            reference_id=record.id,
        )
        db.add(notif)

    await db.flush()
    return _build_settlement_out(record, payer, payee)
