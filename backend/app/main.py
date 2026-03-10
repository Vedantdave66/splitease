import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import auth, groups, expenses, settlements, notifications, me, friends, wallet, bank_links, requests, plaid_routes, stripe_routes
from app.services import balance_service


from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Simple auto-migration for existing databases
    # Isolated so that an error doesn't abort the entire Postgres transaction block
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN interac_email VARCHAR(255);"))
    except Exception:
        pass  # Ignore if column already exists
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN wallet_balance FLOAT DEFAULT 0.0;"))
    except Exception:
        pass  # Ignore if column already exists
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE provider_accounts ADD COLUMN access_token VARCHAR(255);"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN stripe_account_id VARCHAR(255);"))
    except Exception:
        pass
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE wallet_transactions ADD COLUMN stripe_payment_id VARCHAR(255);"))
    except Exception:
        pass

    yield


app = FastAPI(title="SplitEase API", version="1.0.0", lifespan=lifespan)

# CORS: allow local dev + production frontend URL from env
cors_origins = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "https://splitease-web.onrender.com"
]
if os.environ.get("CORS_ORIGINS"):
    cors_origins.extend([o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(balance_service.router)
app.include_router(settlements.router)
app.include_router(notifications.router)
app.include_router(friends.router)
app.include_router(wallet.router)
app.include_router(bank_links.router)
app.include_router(requests.router)
app.include_router(plaid_routes.router)
app.include_router(stripe_routes.router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "SplitEase API is running"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
