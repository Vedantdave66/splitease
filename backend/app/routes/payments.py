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
import logging
from datetime import datetime, timedelta
from app.config import get_settings

logger = logging.getLogger("splitease.payments")

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
    correlation_id = str(uuid.uuid4())[:8]
    logger.info(f"[{correlation_id}] Initiating payment creation: user={current_user.id} amount={data.amount} payee={data.payee_id}")

    # 1. Rate Limiting: Max 5 attempts per minute
    one_minute_ago = datetime.now() - timedelta(minutes=1)
    rate_limit_check = await db.execute(
        select(Payment).where(
            Payment.payer_id == current_user.id,
            Payment.created_at > one_minute_ago
        )
    )
    if len(rate_limit_check.scalars().all()) >= 5:
        logger.warning(f"[{correlation_id}] Rate limit exceeded for user {current_user.id}")
        raise HTTPException(status_code=429, detail="Too many payment attempts. Please wait a minute.")

    # 2. Pre-Flight Check: Verify Payee
    payee_result = await db.execute(select(User).where(User.id == data.payee_id))
    payee = payee_result.scalars().first()
    
    if not payee or not getattr(payee, 'stripe_account_id', None):
        logger.error(f"[{correlation_id}] Payment failed: Payee {data.payee_id} has no connected Stripe account")
        raise HTTPException(status_code=400, detail="Recipient must connect bank account to receive payments")

    # 3. Duplicate Prevention: Check for existing processing payment for this settlement
    if data.settlement_id:
        existing_check = await db.execute(
            select(Payment).where(
                Payment.settlement_id == data.settlement_id,
                Payment.status.in_(["pending", "processing", "succeeded"])
            )
        )
        if existing_check.scalars().first():
            logger.warning(f"[{correlation_id}] Duplicate payment attempt for settlement {data.settlement_id}")
            raise HTTPException(status_code=400, detail="A payment for this settlement is already in progress or completed.")

    # 4. Create Payment model DB record (Deterministic state: pending)
    new_payment = Payment(
        payer_id=current_user.id,
        payee_id=data.payee_id,
        amount=data.amount,
        settlement_id=data.settlement_id,
        status="pending"
    )
    db.add(new_payment)
    await db.flush()
    logger.info(f"[{correlation_id}] Internal payment record created: id={new_payment.id}")

    try:
        # 5. Create Stripe PaymentIntent (Strict Source of Truth)
        intent = stripe.PaymentIntent.create(
            amount=data.amount,
            currency="cad",
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
        
        logger.info(f"[{correlation_id}] Stripe PaymentIntent created: id={intent.id}")

        new_payment.stripe_payment_intent_id = intent.id
        new_payment.status = "processing"
        
        await db.commit()
        return {"client_secret": intent.client_secret, "payment_id": new_payment.id}

    except Exception as e:
        logger.error(f"[{correlation_id}] Stripe error: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
