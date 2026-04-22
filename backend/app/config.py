from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres.gazgcmcvcajxqnxlwjmv:MessiwonWC2022$@db.gazgcmcvcajxqnxlwjmv.supabase.co:5432/postgres"
    SECRET_KEY: str = "super-secret-dev-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@send.tandempay.ca"
    FRONTEND_URL: str = "http://localhost:5173"

    # Plaid Configuration
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"

    # Stripe Configuration
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Admin
    ADMIN_SECRET: str = "tandem-admin-reset-2026"

    class Config:
        env_file = ".env"

    @property
    def effective_database_url(self) -> str:
        # HARDCODED direct connection URL (port 5432) to bypass Vercel env vars 
        # AND bypass the Supabase Pooler (which causes random hangs on AWS Lambda).
        return "postgresql+psycopg://postgres.gazgcmcvcajxqnxlwjmv:MessiwonWC2022$@db.gazgcmcvcajxqnxlwjmv.supabase.co:5432/postgres"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
