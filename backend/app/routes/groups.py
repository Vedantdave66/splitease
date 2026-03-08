from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Group, GroupMember, Expense
from app.schemas import GroupCreate, GroupOut, GroupListOut, MemberAdd, GroupMemberOut
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("", response_model=GroupOut)
async def create_group(data: GroupCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = Group(name=data.name, created_by=current_user.id)
    db.add(group)
    await db.flush()

    # Add creator as a member
    member = GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(member)
    await db.flush()
    await db.refresh(group, attribute_names=["members"])

    members_out = [
        GroupMemberOut(user_id=current_user.id, name=current_user.name, email=current_user.email, avatar_color=current_user.avatar_color)
    ]

    return GroupOut(
        id=group.id,
        name=group.name,
        created_by=group.created_by,
        created_at=group.created_at,
        members=members_out,
        total_expenses=0,
    )


@router.get("", response_model=list[GroupListOut])
async def list_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get all group IDs the user is a member of
    member_q = select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
    result = await db.execute(
        select(Group)
        .where(Group.id.in_(member_q))
        .options(selectinload(Group.members))
        .options(selectinload(Group.expenses))
        .order_by(Group.created_at.desc())
    )
    groups = result.scalars().all()

    out = []
    for g in groups:
        total = sum(e.amount for e in g.expenses)
        out.append(GroupListOut(
            id=g.id,
            name=g.name,
            created_by=g.created_by,
            created_at=g.created_at,
            member_count=len(g.members),
            total_expenses=total,
        ))
    return out


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(group_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .options(selectinload(Group.expenses))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check membership
    is_member = any(m.user_id == current_user.id for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    members_out = [
        GroupMemberOut(user_id=m.user.id, name=m.user.name, email=m.user.email, avatar_color=m.user.avatar_color)
        for m in group.members
    ]
    total = sum(e.amount for e in group.expenses)

    return GroupOut(
        id=group.id,
        name=group.name,
        created_by=group.created_by,
        created_at=group.created_at,
        members=members_out,
        total_expenses=total,
    )


@router.post("/{group_id}/members", response_model=GroupMemberOut)
async def add_member(group_id: str, data: MemberAdd, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify group exists and user is a member
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    is_member = any(m.user_id == current_user.id for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user_to_add = result.scalar_one_or_none()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found with that email")

    # Check if already a member
    already = any(m.user_id == user_to_add.id for m in group.members)
    if already:
        raise HTTPException(status_code=400, detail="User is already a member")

    member = GroupMember(group_id=group_id, user_id=user_to_add.id)
    db.add(member)
    await db.flush()

    return GroupMemberOut(
        user_id=user_to_add.id,
        name=user_to_add.name,
        email=user_to_add.email,
        avatar_color=user_to_add.avatar_color,
    )


@router.post("/{group_id}/join", response_model=GroupMemberOut)
async def join_group(group_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify group exists
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if already a member
    already = any(m.user_id == current_user.id for m in group.members)
    if already:
        # Just return success if they are already in it instead of throwing an error
        return GroupMemberOut(
            user_id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            avatar_color=current_user.avatar_color,
        )

    # Add member
    member = GroupMember(group_id=group_id, user_id=current_user.id)
    db.add(member)
    await db.flush()

    return GroupMemberOut(
        user_id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        avatar_color=current_user.avatar_color,
    )


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete the group")

    await db.delete(group)
    await db.flush()
    return None


@router.delete("/{group_id}/members/{user_id}", status_code=204)
async def remove_member(group_id: str, user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify group exists
    result = await db.execute(
        select(Group).where(Group.id == group_id).options(selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Only a member can remove someone, and you can only remove yourself OR the creator can remove anyone
    is_member = any(m.user_id == current_user.id for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
        
    if current_user.id != user_id and current_user.id != group.created_by:
        raise HTTPException(status_code=403, detail="Only the group creator can remove other members")

    # Find the member record
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    member_record = result.scalar_one_or_none()
    
    if not member_record:
        raise HTTPException(status_code=404, detail="Member not found in this group")
        
    # Prevent removing the creator
    if user_id == group.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove the group creator")

    # Prevent removing if they mapped to an active expense
    # For a fully robust app we'd do a check here. For now, since user wants the ability to remove,
    # we'll just delete the membership. Expenses they were part of will still have them as participants 
    # (unless we explicitly cascade, but we aren't cascading member deletion to expenses by default).

    await db.delete(member_record)
    await db.flush()
    return None
