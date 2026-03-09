from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import ProviderAccount, User
from app.routes.auth import get_current_user
from app.schemas import ProviderAccountOut

router = APIRouter(prefix="/api/bank-links", tags=["Bank Links"])

@router.post("", response_model=ProviderAccountOut)
async def link_bank_account(
    institution_name: str,
    account_mask: str,
    provider: str = "plaid",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates the callback from a provider like Plaid Link.
    Creates a new linked ProviderAccount for the user.
    """
    account_id = f"acc_{provider}_{account_mask}_{current_user.id[:8]}"
    
    new_account = ProviderAccount(
        user_id=current_user.id,
        provider=provider,
        account_id=account_id,
        account_mask=account_mask,
        institution_name=institution_name,
        status="linked"
    )
    
    db.add(new_account)
    await db.commit()
    await db.refresh(new_account)
    return new_account

@router.get("", response_model=list[ProviderAccountOut])
async def get_linked_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all linked bank accounts for the current user.
    """
    result = await db.execute(
        select(ProviderAccount).filter(ProviderAccount.user_id == current_user.id)
    )
    accounts = result.scalars().all()
    return accounts

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_linked_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Removes a linked bank account.
    """
    result = await db.execute(
        select(ProviderAccount)
        .filter(ProviderAccount.id == account_id, ProviderAccount.user_id == current_user.id)
    )
    account = result.scalars().first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
        
    await db.delete(account)
    await db.commit()
