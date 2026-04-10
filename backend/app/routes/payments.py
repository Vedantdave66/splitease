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
    logger.info(f"[{correlation_id}] Initiating payment creation: user={current_user.id} amount={data.amount} payee={data.payee_id} settlement={data.settlement_id}")

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

    # 3. Single Active Payment Enforcement (CRITICAL)
    if data.settlement_id:
        existing_result = await db.execute(
            select(Payment).where(
                Payment.settlement_id == data.settlement_id,
                Payment.payer_id == current_user.id,
                Payment.status.in_(["pending", "processing", "succeeded"])
            )
        )
        existing_payment = existing_result.scalars().first()

        if existing_payment:
            logger.info(f"[{correlation_id}] Existing payment found: id={existing_payment.id} status={existing_payment.status}")
            
            # Fetch absolute status from Stripe source of truth
            if existing_payment.stripe_payment_intent_id:
                try:
                    intent = stripe.PaymentIntent.retrieve(existing_payment.stripe_payment_intent_id)
                    status = intent.status
                    logger.info(f"[{correlation_id}] Stripe PI status: {status}")

                    if status == "succeeded":
                        return {"status": "already_completed", "payment_id": existing_payment.id, "client_secret": None}
                    
                    if status == "processing":
                        # Still processing — return secret so frontend can track it
                        return {
                            "status": "already_processing", 
                            "payment_id": existing_payment.id,
                            "client_secret": intent.client_secret
                        }
                    
                    if status in ["requires_action", "requires_confirmation"]:
                        # SAFE RESUMPTION: Return existing secret for 3DS or confirmation
                        logger.info(f"[{correlation_id}] Resuming existing PI: {existing_payment.stripe_payment_intent_id}")
                        return {
                            "client_secret": intent.client_secret, 
                            "payment_id": existing_payment.id,
                            "status": "created",
                            "resumed": True
                        }

                    # If status is terminal or needs hard reset
                    if status in ["requires_payment_method", "canceled"]:
                        # Safe Cancellation: Only cancel if in safe state
                        if status == "requires_payment_method":
                            try:
                                stripe.PaymentIntent.cancel(existing_payment.stripe_payment_intent_id)
                                logger.info(f"[{correlation_id}] Canceled abandoned PI: {existing_payment.stripe_payment_intent_id}")
                            except Exception as cancel_err:
                                logger.warning(f"[{correlation_id}] Could not cancel PI {existing_payment.stripe_payment_intent_id}: {str(cancel_err)}")
                        
                        existing_payment.status = "expired"
                        await db.flush()
                except Exception as e:
                    logger.error(f"[{correlation_id}] Error auditing existing PI: {str(e)}")
                    # If Stripe failed, we might still have a DB conflict. 
                    # For safety, if we can't confirm status, we fallback to marking expired if safe.
                    if existing_payment.status not in ["succeeded", "processing"]:
                        existing_payment.status = "expired"


    # 4. Create NEW Payment model DB record
    new_payment = Payment(
        payer_id=current_user.id,
        payee_id=data.payee_id,
        amount=data.amount,
        settlement_id=data.settlement_id,
        status="pending"
    )
    db.add(new_payment)
    await db.flush()
    logger.info(f"[{correlation_id}] NEW internal payment record created: id={new_payment.id}")

    try:
        # 5. Create Fresh Stripe PaymentIntent
        # Use UNIQUE Stripe idempotency key per call
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
            idempotency_key=f"pi_create_req_{uuid.uuid4()}" 
        )
        
        logger.info(f"[{correlation_id}] Fresh Stripe PaymentIntent created: id={intent.id} status={intent.status} client_secret={intent.client_secret[:20]}...")

        new_payment.stripe_payment_intent_id = intent.id
        # Keep status as 'pending' — it transitions to 'processing' only when 
        # Stripe actually starts processing (after user submits payment method)
        
        await db.commit()
        
        response = {
            "client_secret": intent.client_secret, 
            "payment_id": new_payment.id,
            "status": "created"
        }
        logger.info(f"[{correlation_id}] Returning to frontend: payment_id={new_payment.id} secret_prefix={intent.client_secret[:20]}...")
        return response

    except Exception as e:
        logger.error(f"[{correlation_id}] Stripe creation error: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

