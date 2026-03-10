import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, ProviderAccount, WalletTransaction, SettlementRecord
from app.routes.auth import get_current_user
from app.config import get_settings

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
    amount: float
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

@router.post("/create-payment-intent")
async def create_payment_intent(
    data: PaymentIntentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a PaymentIntent pulling from user's Plaid account to payee's Stripe account.
    """
    # 1. Look up Payee to get their Stripe Account ID
    result = await db.execute(select(User).filter(User.id == data.payee_id))
    payee = result.scalars().first()
    
    if not payee or not payee.stripe_account_id:
        raise HTTPException(status_code=400, detail="Payee has not set up their Stripe account to receive funds.")
        
    # 2. Look up Payer's selected ProviderAccount (Plaid)
    result = await db.execute(
        select(ProviderAccount).filter(ProviderAccount.id == data.provider_account_id, ProviderAccount.user_id == current_user.id)
    )
    provider_account = result.scalars().first()
    
    if not provider_account or not provider_account.access_token:
        raise HTTPException(status_code=400, detail="Invalid bank account selected.")
        
    # 3. Exchange Plaid Access Token for Stripe Bank Account Token
    try:
        request = ProcessorStripeBankAccountTokenCreateRequest(
            access_token=provider_account.access_token,
            account_id=provider_account.account_id
        )
        plaid_response = plaid_client.processor_stripe_bank_account_token_create(request)
        bank_account_token = plaid_response['stripe_bank_account_token']
        
        # 4. Create a Stripe Customer and attach the bank account
        customer = stripe.Customer.create(
            source=bank_account_token,
            email=current_user.email,
            description=current_user.name
        )
        
        # 5. Create Payment Intent
        # Stripe expects amounts in cents
        amount_cents = int(data.amount * 100)
        
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=customer.id,
            payment_method_types=["us_bank_account"],
            transfer_data={
                "destination": payee.stripe_account_id,
            },
            # Verify micro-deposits automatically for sandbox
            payment_method_options={
                "us_bank_account": {
                    "financial_connections": {"permissions": ["payment_method", "balances"]}
                }
            } if settings.PLAID_ENV != 'sandbox' else None
        )
        
        return {
            "client_secret": intent.client_secret,
            "status": intent.status
        }
    except Exception as e:
        print("Stripe/Plaid Integration Error:", str(e))
        raise HTTPException(status_code=400, detail="Failed to initiate secure bank transfer.")

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    endpoint_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)
    
    event = None
    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        else:
            # If no webhook secret is configured (e.g. local dev without ngrok)
            # just parse the JSON normally. WARNING: Not secure for production!
            import json
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event.type == 'payment_intent.succeeded':
        payment_intent = event.data.object
        print(f"PaymentIntent for {payment_intent.amount} was successful!")
        # Typically we'd find the SettlementRecord and mark it Complete here.

    elif event.type == 'payment_intent.payment_failed':
        payment_intent = event.data.object
        print(f"PaymentIntent failed: {payment_intent.last_payment_error.message}")

    return {"status": "success"}
