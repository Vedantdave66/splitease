import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import PaymentRequest, User, GroupMember, Notification, WalletTransaction
from app.routes.auth import get_current_user
from app.schemas import PaymentRequestCreate, PaymentRequestOut

router = APIRouter(prefix="/api", tags=["Payment Requests"])

@router.post("/groups/{group_id}/requests", response_model=PaymentRequestOut)
async def create_payment_request(
    group_id: str,
    data: PaymentRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a direct peer-to-peer payment request within a group.
    """
    # Verify group membership for both
    result = await db.execute(
        select(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id.in_([current_user.id, data.payer_id])
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
        status="pending"
    )
    
    db.add(new_request)
    
    # Notify the payer
    notification = Notification(
        user_id=data.payer_id,
        type="payment_request_received",
        title="New Payment Request",
        message=f"{current_user.name} requested ${data.amount:.2f}",
        reference_id=new_request.id,
        group_id=group_id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(new_request)
    
    # Reload with relationships for schema output
    result = await db.execute(
        select(PaymentRequest)
        .options(selectinload(PaymentRequest.requester), selectinload(PaymentRequest.payer))
        .filter(PaymentRequest.id == new_request.id)
    )
    reloaded = result.scalars().first()
    
    # Map to schema manually due to nested properties
    return PaymentRequestOut(
        **reloaded.__dict__,
        requester_name=reloaded.requester.name,
        requester_avatar=reloaded.requester.avatar_color,
        payer_name=reloaded.payer.name,
        payer_avatar=reloaded.payer.avatar_color
    )

@router.get("/groups/{group_id}/requests", response_model=list[PaymentRequestOut])
async def get_group_requests(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all pending/processing/completed requests in a group for the current user.
    """
    result = await db.execute(
        select(PaymentRequest)
        .options(selectinload(PaymentRequest.requester), selectinload(PaymentRequest.payer))
        .filter(
            PaymentRequest.group_id == group_id,
            (PaymentRequest.requester_id == current_user.id) | (PaymentRequest.payer_id == current_user.id)
        )
        .order_by(PaymentRequest.created_at.desc())
    )
    requests = result.scalars().all()
    
    out = []
    for r in requests:
        out.append(PaymentRequestOut(
            **r.__dict__,
            requester_name=r.requester.name,
            requester_avatar=r.requester.avatar_color,
            payer_name=r.payer.name,
            payer_avatar=r.payer.avatar_color
        ))
    return out

@router.put("/requests/{request_id}/pay", response_model=PaymentRequestOut)
async def pay_request_with_wallet(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Settle a payment request using internal wallet balance.
    This creates matching WalletTransactions.
    """
    result = await db.execute(
        select(PaymentRequest)
        .options(selectinload(PaymentRequest.requester), selectinload(PaymentRequest.payer))
        .filter(PaymentRequest.id == request_id, PaymentRequest.payer_id == current_user.id)
    )
    pr = result.scalars().first()
    
    if not pr:
        raise HTTPException(status_code=404, detail="Request not found or you are not the payer")
        
    if pr.status in ["settled", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Request cannot be paid in its current state")
        
    if current_user.wallet_balance < pr.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        
    # 1. Update balances
    current_user.wallet_balance -= pr.amount
    pr.requester.wallet_balance += pr.amount
    
    # 2. Update request status
    pr.status = "settled"
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 3. Create double-entry WalletTransactions
    tx_out = WalletTransaction(
        user_id=current_user.id,
        type="transfer_out",
        amount=-pr.amount,
        status="completed",
        reference_id=pr.id,
        completed_at=now
    )
    tx_in = WalletTransaction(
        user_id=pr.requester_id,
        type="transfer_in",
        amount=pr.amount,
        status="completed",
        reference_id=pr.id,
        completed_at=now
    )
    
    db.add(tx_out)
    db.add(tx_in)
    
    # 4. Notify requester
    notification = Notification(
        user_id=pr.requester_id,
        type="payment_received",
        title="Payment Received!",
        message=f"{current_user.name} paid your request for ${pr.amount:.2f}",
        reference_id=pr.id,
        group_id=pr.group_id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(pr)
    
    return PaymentRequestOut(
        **pr.__dict__,
        requester_name=pr.requester.name,
        requester_avatar=pr.requester.avatar_color,
        payer_name=pr.payer.name,
        payer_avatar=pr.payer.avatar_color
    )
