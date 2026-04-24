import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.database import engine, Base
from app.routes import auth, groups, expenses, settlements, notifications, me, friends, wallet, bank_links, requests, plaid_routes, stripe_routes, users, payments
from app.routes import reminders
from app.services import balance_service
from app.services.reconciliation import router as reconciliation_router
from app.services.reminder_scheduler import process_due_reminders
from app.idempotency import IdempotencyKey  # noqa: F401 — ensures table is created

logger = logging.getLogger("tandempay.main")


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

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN has_completed_payment BOOLEAN DEFAULT FALSE;"))
    except Exception:
        pass  # Column already exists

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE payments ADD COLUMN payout_arrival_date VARCHAR(50);"))
    except Exception:
        pass

    # Handle Payment Settlement CASCADE for Group deletion
    try:
        async with engine.begin() as conn:
            # Re-create the constraint with CASCADE to allow group deletion when Stripe payments exist
            await conn.execute(text("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_settlement_id_fkey;"))
            await conn.execute(text("ALTER TABLE payments ADD CONSTRAINT payments_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES settlement_records(id) ON DELETE CASCADE;"))
    except Exception as e:
        logger.warning(f"Could not update payments cascade constraint: {e}")

    # Add UniqueConstraint to Payment if it doesn't exist
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE payments ADD CONSTRAINT uq_payment_settlement_payer UNIQUE (settlement_id, payer_id);"))
    except Exception:
        pass

    # Start the reconciliation scheduler
    from app.services.payment_reconciliation import run_payment_reconciliation
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        process_due_reminders,
        trigger=IntervalTrigger(minutes=60),
        id="reminder_tick",
        name="Process due expense reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        run_payment_reconciliation,
        trigger=IntervalTrigger(minutes=30),
        id="reconciliation_tick",
        name="Automated payment reconciliation",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Schedulers started (Reminders 60m, Reconciliation 30m).")

    yield

    # Shutdown scheduler
    scheduler.shutdown(wait=False)
    logger.info("Reminder scheduler stopped.")

app = FastAPI(title="Tandem API", version="1.0.0", lifespan=lifespan)

# CORS: allow local dev + production frontend URL from env

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local dev
        "http://localhost:3000",
        "http://localhost:5173",
        # Production frontend
        "https://tandempay.ca",
        "https://www.tandempay.ca",
        # API subdomain (needed for same-origin requests via api.tandempay.ca)
        "https://api.tandempay.ca",
    ],
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
app.include_router(users.router)
app.include_router(reminders.router)
app.include_router(payments.router)
app.include_router(reconciliation_router)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Tandem API is running"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
