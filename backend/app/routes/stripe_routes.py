import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, ProviderAccount, WalletTransaction, SettlementRecord, Payment, StripeEvent
from app.routes.auth import get_current_user
from app.config import get_settings
from app.idempotency import idempotent

import plaid
from plaid.api import plaid_api
from plaid.model.processor_stripe_bank_account_token_create_request import ProcessorStripeBankAccountTokenCreateRequest

router = APIRouter(prefix="/api/stripe", tags=["Stripe"])
settings = get_settings()

stripe.api_key = settings.STRIPE_SECRET_KEY

# Setup Plaid client for processor token exchange
configuration = plaid.Configuration(
    host=plaid.Environment.Sandbox if settings.PLAID_ENV == 'sandbox' else plaid.Environment.Production,
    api_key={
        'clientId': settings.PLAID_CLIENT_ID,
        'secret': settings.PLAID_SECRET,
    }
)
api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)

class PaymentIntentRequest(BaseModel):
    amount: Decimal
    payee_id: str
    provider_account_id: str

@router.post("/onboard")
async def onboard_user(
    return_path: str = "/dashboard",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a Stripe Express account for the user so they can receive payouts.
    """
    if not current_user.stripe_account_id:
        try:
            account = stripe.Account.create(
                type="express",
                email=current_user.email,
                capabilities={
                    "transfers": {"requested": True},
                },
            )
            current_user.stripe_account_id = account.id
            await db.commit()
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    # Create an onboarding link
    try:
        clean_path = return_path.lstrip("/")
        account_link = stripe.AccountLink.create(
            account=current_user.stripe_account_id,
            refresh_url=f"{settings.FRONTEND_URL}/{clean_path}",
            return_url=f"{settings.FRONTEND_URL}/{clean_path}",
            type="account_onboarding",
        )
        return {"url": account_link.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status")
async def get_onboarding_status(
    current_user: User = Depends(get_current_user)
):
    if not current_user.stripe_account_id:
        return {"onboarded": False}
        
    try:
        account = stripe.Account.retrieve(current_user.stripe_account_id)
        
        if account.details_submitted:
            # Check for any pending claims for this user
            result = await db.execute(
                select(Payment).where(
                    Payment.payee_id == current_user.id, 
                    Payment.status == "pending_claim"
                )
            )
            pending_claims = result.scalars().all()
            
            if pending_claims:
                from app.models import Notification
                import logging
                logger = logging.getLogger("splitease.onboarding")
                
                for p in pending_claims:
                    # Mark it so we don't double-notify
                    p.status = "pending_claim_ready"
                    
                    # Notify the payer
                    notif = Notification(
                        user_id=p.payer_id,
                        type="payment_claim_ready",
                        title="They are ready to be paid!",
                        message=f"{current_user.name} has set up their bank account. You can now send them the ${p.amount / 100:.2f}.",
                        reference_id=p.id,
                        group_id=None
                    )
                    db.add(notif)
                    logger.info(f"Resolved pending claim {p.id}, notified payer {p.payer_id}")
                
                await db.commit()
                
        return {"onboarded": account.details_submitted}
    except Exception as e:
        return {"onboarded": False}



@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    import traceback
    import logging
    logger = logging.getLogger("splitease.webhooks")
    
    try:
        payload = await request.body()
        sig_header = request.headers.get("Stripe-Signature", "")
        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET
        
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")

        # 1. Webhook Idempotency: Check if already processed
        event_check = await db.execute(select(StripeEvent).where(StripeEvent.id == event.id))
        if event_check.scalars().first():
            logger.info(f"Ignoring duplicate webhook event: {event.id}")
            return {"status": "ignored", "reason": "duplicate"}

        event_logger = f"event_id={event.id} type={event.type}"
        logger.info(f"Processing webhook: {event_logger}")

        if event.type == 'payment_intent.succeeded':
            intent = event.data.object
            metadata = intent.get('metadata', {})
            payment_id = metadata.get("payment_id")
            
            if not payment_id:
                logger.warning(f"No payment_id found in metadata for {event_logger}")
            else:
                result = await db.execute(select(Payment).where(Payment.id == payment_id))
                payment = result.scalars().first()
                
                if payment:
                    if payment.status != "succeeded":
                        # STRICT TRANSFER VALIDATION
                        try:
                            latest_charge_id = intent.get("latest_charge")
                            if latest_charge_id:
                                charge = stripe.Charge.retrieve(latest_charge_id)
                                transfer_id = charge.get("transfer")
                                if transfer_id:
                                    transfer = stripe.Transfer.retrieve(transfer_id)
                                    if transfer.status != "succeeded":
                                        logger.error(f"Transfer {transfer_id} failed for payment {payment_id}")
                                        payment.status = "failed"
                                        await db.commit()
                                        return {"status": "failed"}
                                    logger.info(f"Transfer {transfer_id} verified as succeeded")
                        except Exception as transfer_err:
                            logger.error(f"Transfer validation error: {str(transfer_err)}")

                        payment.status = "succeeded"
                        
                        # Calculate +2 business days for payout arrival
                        from datetime import datetime, timedelta
                        now = datetime.now()
                        days_to_add = 2
                        while days_to_add > 0:
                            now += timedelta(days=1)
                            if now.weekday() < 5:
                                days_to_add -= 1
                        payment.payout_arrival_date = now.strftime("%b %d")

                        if payment.settlement_id and payment.settlement_id != "none":
                            settlement_res = await db.execute(select(SettlementRecord).where(SettlementRecord.id == payment.settlement_id))
                            settlement = settlement_res.scalars().first()
                            if settlement:
                                settlement.status = "settled"
                        logger.info(f"Payment {payment_id} marked as succeeded")
        
        elif event.type == 'payment_intent.payment_failed':
            intent = event.data.object
            metadata = intent.get('metadata', {})
            payment_id = metadata.get("payment_id")
            
            result = await db.execute(select(Payment).where(Payment.id == payment_id))
            payment = result.scalars().first()
            if payment and payment.status not in ["succeeded", "failed"]:
                payment.status = "failed"
                logger.info(f"Payment {payment_id} marked as failed")

        elif event.type == 'payment_intent.canceled':
            intent = event.data.object
            metadata = intent.get('metadata', {})
            payment_id = metadata.get("payment_id")
            
            result = await db.execute(select(Payment).where(Payment.id == payment_id))
            payment = result.scalars().first()
            if payment:
                payment.status = "expired"
                logger.info(f"Payment {payment_id} marked as expired via cancellation")

        # 2. Commit transaction and record the event for idempotency
        new_event = StripeEvent(id=event.id, type=event.type)
        db.add(new_event)
        await db.commit()
        return {"status": "success"}

    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"Webhook error: {error_msg}")
        await db.rollback()
        raise HTTPException(status_code=400, detail="Webhook error")

@router.post("/reconcile/{payment_id}")
async def reconcile_payment(payment_id: str, db: AsyncSession = Depends(get_db)):
    """
    Manually reconcile a payment using Stripe as the source of truth.
    Ensures absolute DB-Stripe synchronization.
    """
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalars().first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    if payment.status == "succeeded":
        return {"status": "succeeded", "resolved": True}
        
    if not payment.stripe_payment_intent_id:
        raise HTTPException(status_code=400, detail="No Stripe intent ID")

    try:
        intent = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
        logger = logging.getLogger("splitease.reconciliation")
        logger.info(f"Reconciling {payment_id}: Stripe status={intent.status}")
        
        if intent.status == "succeeded":
            payment.status = "succeeded"
            
            # Calculate +2 business days for payout arrival
            from datetime import datetime, timedelta
            now = datetime.now()
            days_to_add = 2
            while days_to_add > 0:
                now += timedelta(days=1)
                if now.weekday() < 5:
                    days_to_add -= 1
            payment.payout_arrival_date = now.strftime("%b %d")

            if payment.settlement_id and payment.settlement_id != "none":
                settlement_res = await db.execute(select(SettlementRecord).where(SettlementRecord.id == payment.settlement_id))
                settlement = settlement_res.scalars().first()
                if settlement:
                    settlement.status = "settled"
            await db.commit()
            return {"status": "succeeded", "resolved": True}
            
        elif intent.status == "canceled":
            payment.status = "expired"
            await db.commit()
            return {"status": "expired", "resolved": True}

        elif intent.status == "requires_payment_method":
            # If it's requires_payment_method, it likely failed or timed out
            payment.status = "failed"
            await db.commit()
            return {"status": "failed", "resolved": True}

        elif intent.status == "processing":
            payment.status = "processing"
            await db.commit()
            return {"status": "processing", "resolved": False}
            
        return {"status": intent.status, "resolved": False}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Reconciliation failed: {str(e)}")

@router.post("/cleanup")
async def cleanup_payments(db: AsyncSession = Depends(get_db)):
    """
    Background job equivalent: Expire payments older than 24h that never reached terminal state.
    """
    from datetime import datetime, timedelta
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    
    result = await db.execute(
        select(Payment).where(
            Payment.status.in_(["pending", "processing"]),
            Payment.created_at < twenty_four_hours_ago
        )
    )
    payments = result.scalars().all()
    
    count = 0
    for p in payments:
        p.status = "expired"
        count += 1
        
    await db.commit()
    return {"status": "success", "expired_count": count}
