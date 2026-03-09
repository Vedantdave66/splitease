from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Notification, WalletTransaction
from app.routes.auth import get_current_user
from app.schemas import UserOut, WalletTransactionOut
import datetime

router = APIRouter(prefix="/api/wallet", tags=["wallet"])

class AddFundsRequest(BaseModel):
    amount: float
    source: str = "Bank Account"

@router.post("/add-funds", response_model=UserOut)
async def add_funds(
    request: AddFundsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Simulate adding funds from an external bank account to the SplitEase wallet."""
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        
    if request.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximum add funds limit is $10,000 at a time")

    # Increment balance
    current_user.wallet_balance += request.amount
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 2. Add ledger transaction
    tx = WalletTransaction(
        user_id=current_user.id,
        type="deposit",
        amount=request.amount,
        status="completed",
        reference_id=request.source,
        completed_at=now
    )
    db.add(tx)
    
    # 3. Generate notification
    notif = Notification(
        user_id=current_user.id,
        type="deposit_completed",
        title="Funds Added",
        message=f"Successfully added ${request.amount:.2f} from {request.source}."
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

class WithdrawFundsRequest(BaseModel):
    amount: float
    destination: str = "Bank Account"

@router.post("/withdraw", response_model=UserOut)
async def withdraw_funds(
    request: WithdrawFundsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Simulate withdrawing funds from Wallet to Bank."""
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        
    if current_user.wallet_balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # 1. Decrement balance
    current_user.wallet_balance -= request.amount
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 2. Add ledger transaction
    tx = WalletTransaction(
        user_id=current_user.id,
        type="withdrawal",
        amount=-request.amount,
        status="completed",
        reference_id=request.destination,
        completed_at=now
    )
    db.add(tx)
    
    # 3. Generate notification
    notif = Notification(
        user_id=current_user.id,
        type="withdrawal_completed",
        title="Withdrawal Complete",
        message=f"Successfully withdrew ${request.amount:.2f} to {request.destination}."
    )
    db.add(notif)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


@router.get("/balance", response_model=UserOut)
async def get_balance(
    current_user: User = Depends(get_current_user)
):
    """Return the current user's wallet profile."""
    return current_user


@router.get("/transactions", response_model=list[WalletTransactionOut])
async def get_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the ledger feed for this user."""
    result = await db.execute(
        select(WalletTransaction)
        .filter(WalletTransaction.user_id == current_user.id)
        .order_by(WalletTransaction.created_at.desc())
    )
    transactions = result.scalars().all()
    return transactions
