from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, text, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Group, GroupMember, SettlementRecord, Expense, ExpenseParticipant
from app.schemas import SettlementRecordOut, UserOut
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/me", tags=["me"])

@router.get("/payments", response_model=list[SettlementRecordOut])
async def get_my_payments(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all settlement records where the user is either the payer or the payee."""
    result = await db.execute(
        select(SettlementRecord)
        .where(
            or_(
                SettlementRecord.payer_id == current_user.id,
                SettlementRecord.payee_id == current_user.id
            )
        )
        .order_by(SettlementRecord.created_at.desc())
    )
    records = result.scalars().all()
    
    # We need to look up Names and Avatar colors for payer/payee
    # It's usually better to do a join, but we can just fetch all users involved for simplicity
    user_ids = set()
    for r in records:
        user_ids.add(r.payer_id)
        user_ids.add(r.payee_id)
        
    user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in user_result.scalars().all()}
    
    out = []
    for r in records:
        payer = users_by_id.get(r.payer_id)
        payee = users_by_id.get(r.payee_id)
        
        out.append(SettlementRecordOut(
            id=r.id,
            group_id=r.group_id,
            payer_id=r.payer_id,
            payer_name=payer.name if payer else "Unknown User",
            payer_avatar_color=payer.avatar_color if payer else "#ccc",
            payee_id=r.payee_id,
            payee_name=payee.name if payee else "Unknown User",
            payee_avatar_color=payee.avatar_color if payee else "#ccc",
            amount=r.amount,
            status=r.status,
            method=r.method,
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
        
    return out


@router.get("/friends", response_model=list[dict])
async def get_my_friends(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all users the current user shares a group with OR has an accepted friend request with."""
    from app.models import FriendRequest
    
    friends_dict = {}

    # 1. Find all groups the user is part of
    my_groups_result = await db.execute(select(GroupMember.group_id).where(GroupMember.user_id == current_user.id))
    my_group_ids = [g for g in my_groups_result.scalars().all()]
    
    if my_group_ids:
        # Find all unique members in those groups (excluding the current user)
        group_friends_result = await db.execute(
            select(User).join(GroupMember, User.id == GroupMember.user_id)
            .where(GroupMember.group_id.in_(my_group_ids), User.id != current_user.id)
            .distinct()
        )
        for f in group_friends_result.scalars().all():
            friends_dict[f.id] = f

    # 2. Find friends from sent accepted friend requests
    sent_requests_stmt = select(User).join(
        FriendRequest, func.lower(User.email) == func.lower(FriendRequest.receiver_email)
    ).where(
        FriendRequest.sender_id == current_user.id,
        FriendRequest.status == 'accepted'
    )
    sent_friends_result = await db.execute(sent_requests_stmt)
    for f in sent_friends_result.scalars().all():
        friends_dict[f.id] = f
        
    # 3. Find friends from received accepted friend requests
    received_requests_stmt = select(User).join(
        FriendRequest, User.id == FriendRequest.sender_id
    ).where(
        func.lower(FriendRequest.receiver_email) == func.lower(current_user.email),
        FriendRequest.status == 'accepted'
    )
    received_friends_result = await db.execute(received_requests_stmt)
    for f in received_friends_result.scalars().all():
        friends_dict[f.id] = f

    # Format output
    out = []
    for f_id, f in friends_dict.items():
        out.append({
            "id": f.id,
            "name": f.name,
            "email": f.email,
            "avatar_color": f.avatar_color,
            "shared_groups_count": 0  # To be calculated if needed
        })
        
    return out
