import logging
from datetime import datetime, timedelta
import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine
from app.models import Payment, SettlementRecord
from app.config import get_settings

settings = get_settings()
stripe.api_key = settings.STRIPE_SECRET_KEY
logger = logging.getLogger("splitease.reconciliation")

async def run_payment_reconciliation():
    """
    Background job to reconcile stuck payments and cleanup expired ones.
    """
    logger.info("Starting automated payment reconciliation...")
    
    async with AsyncSession(engine) as db:
        # 1. Reconciliation: Query Stripe for 'processing' payments older than 15 mins
        fifteen_mins_ago = datetime.now() - timedelta(minutes=15)
        result = await db.execute(
            select(Payment).where(
                Payment.status == "processing",
                Payment.updated_at < fifteen_mins_ago
            )
        )
        stuck_payments = result.scalars().all()
        
        for p in stuck_payments:
            if not p.stripe_payment_intent_id:
                continue
                
            try:
                intent = stripe.PaymentIntent.retrieve(p.stripe_payment_intent_id)
                logger.info(f"Reconciling payment {p.id}: Stripe status is {intent.status}")
                
                if intent.status == "succeeded":
                    p.status = "succeeded"
                    if p.settlement_id:
                        settlement_res = await db.execute(select(SettlementRecord).where(SettlementRecord.id == p.settlement_id))
                        settlement = settlement_res.scalars().first()
                        if settlement:
                            settlement.status = "settled"
                elif intent.status in ["canceled", "requires_payment_method"]:
                    p.status = "failed"
            except Exception as e:
                logger.error(f"Failed to reconcile payment {p.id}: {str(e)}")

        # 2. Cleanup: Expire payments older than 24h
        twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
        expire_result = await db.execute(
            select(Payment).where(
                Payment.status.in_(["pending", "processing"]),
                Payment.created_at < twenty_four_hours_ago
            )
        )
        expired_payments = expire_result.scalars().all()
        for p in expired_payments:
            logger.info(f"Expiring payment {p.id}")
            p.status = "expired"

        await db.commit()
    logger.info("Payment reconciliation finished.")
