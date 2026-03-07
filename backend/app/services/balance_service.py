from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Group, GroupMember, Expense, ExpenseParticipant
from app.schemas import UserBalance, Settlement
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/groups/{group_id}", tags=["balances"])


async def _verify_membership(group_id: str, user_id: str, db: AsyncSession) -> Group:
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members).selectinload(GroupMember.user))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    is_member = any(m.user_id == user_id for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return group


async def _compute_balances(group_id: str, db: AsyncSession) -> dict:
    """Compute net balance for each user in the group."""
    # Get all expenses with participants
    result = await db.execute(
        select(Expense)
        .where(Expense.group_id == group_id)
        .options(selectinload(Expense.participants))
    )
    expenses = result.scalars().all()

    # Track total paid and total owed per user
    total_paid: dict[str, float] = {}
    total_owed: dict[str, float] = {}

    for expense in expenses:
        # The payer paid the full amount
        total_paid[expense.paid_by] = total_paid.get(expense.paid_by, 0) + expense.amount

        # Each participant owes their share
        for p in expense.participants:
            total_owed[p.user_id] = total_owed.get(p.user_id, 0) + p.share_amount

    return {"total_paid": total_paid, "total_owed": total_owed}


@router.get("/balances", response_model=list[UserBalance])
async def get_balances(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _verify_membership(group_id, current_user.id, db)
    data = await _compute_balances(group_id, db)

    balances = []
    for member in group.members:
        user = member.user
        paid = data["total_paid"].get(user.id, 0)
        owed = data["total_owed"].get(user.id, 0)
        net = round(paid - owed, 2)
        balances.append(UserBalance(
            user_id=user.id,
            name=user.name,
            avatar_color=user.avatar_color,
            total_paid=round(paid, 2),
            total_owed=round(owed, 2),
            net_balance=net,
        ))

    return balances


@router.get("/settlements", response_model=list[Settlement])
async def get_settlements(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _verify_membership(group_id, current_user.id, db)
    data = await _compute_balances(group_id, db)

    # Build user info map
    user_info = {}
    for member in group.members:
        user = member.user
        user_info[user.id] = {"name": user.name, "avatar_color": user.avatar_color}

    # Compute net balances
    net: dict[str, float] = {}
    all_user_ids = set(data["total_paid"].keys()) | set(data["total_owed"].keys())
    for uid in all_user_ids:
        paid = data["total_paid"].get(uid, 0)
        owed = data["total_owed"].get(uid, 0)
        balance = round(paid - owed, 2)
        if abs(balance) > 0.01:
            net[uid] = balance

    # Greedy debt simplification
    creditors = sorted(
        [(uid, bal) for uid, bal in net.items() if bal > 0],
        key=lambda x: -x[1]
    )
    debtors = sorted(
        [(uid, -bal) for uid, bal in net.items() if bal < 0],
        key=lambda x: -x[1]
    )

    settlements = []
    i, j = 0, 0
    while i < len(creditors) and j < len(debtors):
        creditor_id, credit = creditors[i]
        debtor_id, debt = debtors[j]

        amount = round(min(credit, debt), 2)
        if amount > 0.01:
            c_info = user_info.get(creditor_id, {"name": "Unknown", "avatar_color": "#3ECF8E"})
            d_info = user_info.get(debtor_id, {"name": "Unknown", "avatar_color": "#3ECF8E"})
            settlements.append(Settlement(
                from_user_id=debtor_id,
                from_user_name=d_info["name"],
                from_avatar_color=d_info["avatar_color"],
                to_user_id=creditor_id,
                to_user_name=c_info["name"],
                to_avatar_color=c_info["avatar_color"],
                amount=amount,
            ))

        credit -= amount
        debt -= amount
        if credit < 0.01:
            i += 1
        else:
            creditors[i] = (creditor_id, credit)
        if debt < 0.01:
            j += 1
        else:
            debtors[j] = (debtor_id, debt)

    return settlements
