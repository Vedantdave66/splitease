import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, ProviderAccount
from app.routes.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/plaid", tags=["Plaid"])
settings = get_settings()

configuration = plaid.Configuration(
    host=plaid.Environment.Sandbox if settings.PLAID_ENV == 'sandbox' else plaid.Environment.Production,
    api_key={
        'clientId': settings.PLAID_CLIENT_ID,
        'secret': settings.PLAID_SECRET,
    }
)
api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

class PublicTokenRequest(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str
    account_id: str

@router.post("/create-link-token")
async def create_link_token(current_user: User = Depends(get_current_user)):
    request = LinkTokenCreateRequest(
        products=[Products("auth"), Products("transactions")],
        client_name="Tandem",
        country_codes=[CountryCode("US"), CountryCode("CA")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=current_user.id)
    )
    try:
        response = client.link_token_create(request)
        return {"link_token": response['link_token']}
    except plaid.ApiException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/set-access-token")
async def set_access_token(
    data: PublicTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Exchange public token for access token
        exchange_request = ItemPublicTokenExchangeRequest(public_token=data.public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response['access_token']
        
        # 2. Get Account details to get the mask
        accounts_req = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_req)
        accounts = accounts_response['accounts']
        
        # Look for the selected account
        target_account = None
        for acc in accounts:
            if acc['account_id'] == data.account_id:
                target_account = acc
                break
                
        if not target_account:
            # Fallback to the first account if mismatch
            target_account = accounts[0]
            
        mask = target_account['mask'] or "0000"
        
        # 3. Create Provider Account Record
        provider_account = ProviderAccount(
            user_id=current_user.id,
            provider="plaid",
            account_id=target_account['account_id'],
            account_mask=mask,
            institution_name=data.institution_name,
            access_token=access_token,
            status="linked"
        )
        
        db.add(provider_account)
        await db.commit()
        await db.refresh(provider_account)
        
        return {
            "id": provider_account.id,
            "provider": provider_account.provider,
            "account_mask": provider_account.account_mask,
            "institution_name": provider_account.institution_name,
            "status": provider_account.status
        }
        
    except plaid.ApiException as e:
        print("Plaid Exception:", e)
        raise HTTPException(status_code=400, detail="Failed to link bank account with Plaid")
