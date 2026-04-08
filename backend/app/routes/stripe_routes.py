import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, ProviderAccount, WalletTransaction, SettlementRecord
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
        account_link = stripe.AccountLink.create(
            account=current_user.stripe_account_id,
            refresh_url=f"{settings.FRONTEND_URL}/me/wallet?stripe_refresh=true",
            return_url=f"{settings.FRONTEND_URL}/me/wallet?stripe_return=true",
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
        return {"onboarded": account.details_submitted}
    except Exception as e:
        return {"onboarded": False}


from app.models import Payment

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    import traceback
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

        if event.type == 'payment_intent.succeeded':
            intent = event.data.object
            metadata = getattr(intent, 'metadata', {})
            payment_id = getattr(metadata, "payment_id", None) if metadata else None
            
            result = await db.execute(select(Payment).where(Payment.id == payment_id))
            payment = result.scalars().first()
            
            # Requirement 2: Webhook safely ignores duplicate or repeated events
            if payment and payment.status == "succeeded":
                return {"status": "success", "message": "Already succeeded"}

            if payment and payment.status != "succeeded":
                payment.status = "succeeded"
                
                # Settlement tracking integration (NO WALLET LOGIC)
                if payment.settlement_id and payment.settlement_id != "none":
                    settlement_res = await db.execute(select(SettlementRecord).where(SettlementRecord.id == payment.settlement_id))
                    settlement = settlement_res.scalars().first()
                    if settlement:
                        settlement.status = "settled"

                # Execute explicit database commit tracking status only
                await db.commit()

        elif event.type == 'payment_intent.payment_failed':
            intent = event.data.object
            metadata = getattr(intent, 'metadata', {})
            payment_id = getattr(metadata, "payment_id", None) if metadata else None
            
            result = await db.execute(select(Payment).where(Payment.id == payment_id))
            payment = result.scalars().first()
            
            # Requirement 2: Handle failed duplicate events identically
            if payment and payment.status == "failed":
                return {"status": "success", "message": "Already failed"}
                
            if payment and payment.status not in ["succeeded", "failed"]:
                payment.status = "failed"
                await db.commit()

        return {"status": "success"}
    except Exception as e:
        error_msg = traceback.format_exc()
        raise HTTPException(status_code=400, detail=error_msg)
