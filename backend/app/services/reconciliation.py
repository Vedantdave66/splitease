import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import stripe

from app.database import get_db
from app.models import User, Payment, SettlementRecord
from app.routes.auth import get_current_user
from app.config import settings

logger = logging.getLogger("splitease.reconciliation")

router = APIRouter(prefix="/api/admin", tags=["Reconciliation"])
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/reconcile-payments")
async def reconcile_stuck_payments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fallback reconciliation: Finds Payment intents stuck in 'processing'
    for over 1 hour and queries the Stripe API to sync their true state.
    """
    # Assuming only admins can hit this or we use a secure scheduled background task.
    # For now, we just perform the logic.

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

    result = await db.execute(
        select(Payment).where(
            Payment.status == "processing",
            Payment.updated_at < one_hour_ago
        )
    )
    stuck_payments = result.scalars().all()

    reconciled_count = 0

    for payment in stuck_payments:
        if not payment.stripe_payment_intent_id:
            continue
            
        try:
            intent = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
            
            if intent.status == "succeeded":
                payment.status = "succeeded"
                if payment.settlement_id and payment.settlement_id != "none":
                    settlement_res = await db.execute(select(SettlementRecord).where(SettlementRecord.id == payment.settlement_id))
                    settlement = settlement_res.scalars().first()
                    if settlement:
                        settlement.status = "settled"
                reconciled_count += 1
                await db.commit()
                logger.info(f"Reconciled payment {payment.id} -> succeeded")

            elif intent.status in ["canceled", "requires_payment_method", "requires_action"]:
                # The payment ultimately failed or timed out
                payment.status = "failed"
                reconciled_count += 1
                await db.commit()
                logger.info(f"Reconciled payment {payment.id} -> failed")

        except Exception as e:
            logger.error(f"Failed to reconcile payment {payment.id}: {e}")
            await db.rollback()

    return {"message": f"Successfully reconciled {reconciled_count} stuck payments out of {len(stuck_payments)} possible."}
