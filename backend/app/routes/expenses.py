from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.database import get_db
from app.models import User, Group, GroupMember, Expense, ExpenseParticipant, Notification
from app.schemas import ExpenseCreate, ExpenseOut, ExpenseParticipantOut
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/groups/{group_id}/expenses", tags=["expenses"])


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


@router.post("", response_model=ExpenseOut)
async def create_expense(
    group_id: str,
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _verify_membership(group_id, current_user.id, db)

    # Verify payer is a member
    member_ids = {m.user_id for m in group.members}
    if data.paid_by not in member_ids:
        raise HTTPException(status_code=400, detail="Payer is not a group member")

    # Verify all participants are members
    for pid in data.participant_ids:
        if pid not in member_ids:
            raise HTTPException(status_code=400, detail=f"Participant {pid} is not a group member")

    # Create expense
    expense = Expense(
        group_id=group_id,
        title=data.title,
        amount=data.amount,
        paid_by=data.paid_by,
        split_type=data.split_type,
    )
    db.add(expense)
    await db.flush()

    # Split equally among participants
    share = (data.amount / Decimal(len(data.participant_ids))).quantize(Decimal("0.01"))
    participants = []
    for pid in data.participant_ids:
        ep = ExpenseParticipant(expense_id=expense.id, user_id=pid, share_amount=share)
        db.add(ep)
        participants.append(ep)

    await db.flush()
    await db.refresh(expense)

    # Get payer name
    payer_result = await db.execute(select(User).where(User.id == data.paid_by))
    payer = payer_result.scalar_one()

    # Build participant output with names
    participant_outs = []
    for ep in participants:
        user_result = await db.execute(select(User).where(User.id == ep.user_id))
        u = user_result.scalar_one()
        participant_outs.append(ExpenseParticipantOut(
            user_id=u.id, name=u.name, share_amount=ep.share_amount, avatar_color=u.avatar_color
        ))

    # Notify participants (except the creator)
    for ep in participants:
        if ep.user_id != current_user.id:
            notif = Notification(
                user_id=ep.user_id,
                type="expense_added",
                title="New Expense",
                message=f"{current_user.name} added \"{data.title}\" (${data.amount:.2f}). Your share: ${ep.share_amount:.2f}",
                group_id=group_id,
                reference_id=expense.id,
            )
            db.add(notif)
    await db.flush()

    return ExpenseOut(
        id=expense.id,
        title=expense.title,
        amount=expense.amount,
        paid_by=expense.paid_by,
        payer_name=payer.name,
        payer_avatar_color=payer.avatar_color,
        split_type=expense.split_type,
        created_at=expense.created_at,
        participants=participant_outs,
    )


@router.get("", response_model=list[ExpenseOut])
async def list_expenses(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_membership(group_id, current_user.id, db)

    result = await db.execute(
        select(Expense)
        .where(Expense.group_id == group_id)
        .options(selectinload(Expense.participants))
        .options(selectinload(Expense.payer))
        .order_by(Expense.created_at.desc())
    )
    expenses = result.scalars().all()

    out = []
    for e in expenses:
        # Get participant names
        participant_outs = []
        for p in e.participants:
            user_result = await db.execute(select(User).where(User.id == p.user_id))
            u = user_result.scalar_one()
            participant_outs.append(ExpenseParticipantOut(
                user_id=u.id, name=u.name, share_amount=p.share_amount, avatar_color=u.avatar_color
            ))

        out.append(ExpenseOut(
            id=e.id,
            title=e.title,
            amount=e.amount,
            paid_by=e.paid_by,
            payer_name=e.payer.name,
            payer_avatar_color=e.payer.avatar_color,
            split_type=e.split_type,
            created_at=e.created_at,
            participants=participant_outs,
        ))
    return out


@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    group_id: str,
    expense_id: str,
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _verify_membership(group_id, current_user.id, db)

    # 1. Fetch the existing expense
    result = await db.execute(
        select(Expense)
        .where(Expense.id == expense_id, Expense.group_id == group_id)
        .options(selectinload(Expense.participants))
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    member_ids = {m.user_id for m in group.members}
    if data.paid_by not in member_ids:
        raise HTTPException(status_code=400, detail="Payer is not a group member")

    for pid in data.participant_ids:
        if pid not in member_ids:
            raise HTTPException(status_code=400, detail=f"Participant {pid} is not a group member")

    # 2. Update basic fields
    expense.title = data.title
    expense.amount = data.amount
    expense.paid_by = data.paid_by
    expense.split_type = data.split_type

    # 3. Wipe old participants and add new ones
    for p in expense.participants:
        await db.delete(p)
    await db.flush()

    share = (data.amount / Decimal(len(data.participant_ids))).quantize(Decimal("0.01"))
    new_participants = []
    for pid in data.participant_ids:
        ep = ExpenseParticipant(expense_id=expense.id, user_id=pid, share_amount=share)
        db.add(ep)
        new_participants.append(ep)

    await db.flush()
    await db.refresh(expense)

    # 4. Fetch updated names for output
    payer_result = await db.execute(select(User).where(User.id == expense.paid_by))
    payer = payer_result.scalar_one()

    participant_outs = []
    for ep in new_participants:
        user_result = await db.execute(select(User).where(User.id == ep.user_id))
        u = user_result.scalar_one()
        participant_outs.append(ExpenseParticipantOut(
            user_id=u.id, name=u.name, share_amount=ep.share_amount, avatar_color=u.avatar_color
        ))

    return ExpenseOut(
        id=expense.id,
        title=expense.title,
        amount=expense.amount,
        paid_by=expense.paid_by,
        payer_name=payer.name,
        payer_avatar_color=payer.avatar_color,
        split_type=expense.split_type,
        created_at=expense.created_at,
        participants=participant_outs,
    )


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    group_id: str,
    expense_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_membership(group_id, current_user.id, db)

    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.group_id == group_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await db.delete(expense)
    await db.flush()
    return None
