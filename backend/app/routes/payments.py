import uuid
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import User, Payment
from app.routes.auth import get_current_user
from app.idempotency import idempotent
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/payments", tags=["Payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY

class PaymentCreateRequest(BaseModel):
    payee_id: str
    amount: int  # in cents
    settlement_id: Optional[str] = None

@router.post("/create")
@idempotent
async def create_payment(
    data: PaymentCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payee_result = await db.execute(select(User).where(User.id == data.payee_id))
    payee = payee_result.scalars().first()
    
    if not payee or not getattr(payee, 'stripe_account_id', None):
        raise HTTPException(status_code=400, detail="Recipient must connect bank account to receive payments")

    # Create Payment model DB record first
    new_payment = Payment(
        payer_id=current_user.id,
        payee_id=data.payee_id,
        amount=data.amount,
        settlement_id=data.settlement_id,
        status="pending"
    )
    db.add(new_payment)
    await db.flush()  # We have new_payment.id now

    try:
        intent = stripe.PaymentIntent.create(
            amount=data.amount,
            currency="usd", # or cad depending on target geography
            automatic_payment_methods={"enabled": True},
            transfer_data={
                "destination": payee.stripe_account_id,
            },
            metadata={
                "payment_id": new_payment.id,
                "payer_id": current_user.id,
                "payee_id": data.payee_id,
                "settlement_id": data.settlement_id or "none",
            },
            idempotency_key=f"pi_create_{new_payment.id}"
        )
        
        new_payment.stripe_payment_intent_id = intent.id
        new_payment.status = "processing"
        
        # We explicitly only mutate payments, leaving wallets out.
        await db.commit()
        return {"client_secret": intent.client_secret, "payment_id": new_payment.id}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
