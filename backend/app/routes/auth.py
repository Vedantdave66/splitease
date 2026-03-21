import random
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer

from app.database import get_db
from app.config import get_settings
from app.models import User
from app.schemas import UserRegister, UserLogin, Token, UserOut, PasswordResetRequest, PasswordResetConfirm
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
settings = get_settings()

AVATAR_COLORS = ["#3ECF8E", "#6366F1", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#14B8A6", "#F97316"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=Token)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    email_lower = data.email.lower()
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email_lower))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=email_lower,
        hashed_password=hash_password(data.password),
        avatar_color=random.choice(AVATAR_COLORS),
        interac_email=data.interac_email.lower() if data.interac_email else None,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    email_lower = data.email.lower()
    result = await db.execute(select(User).where(User.email == email_lower))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.id})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


import resend

resend.api_key = settings.RESEND_API_KEY

def send_reset_email_sync(to_email: str, reset_link: str) -> dict:
    """
    Sends a password reset email via Resend and returns the full API response.
    Returns a dict with {'success': bool, 'response': any, 'error': str}
    """
    if not settings.RESEND_API_KEY:
        msg = f"RESEND_API_KEY not configured. Mocking email to {to_email}"
        print(f"DEBUG: {msg}")
        return {"success": False, "error": "API Key not configured", "response": None}

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h1 style="color: #18181b; font-size: 24px; margin-bottom: 10px;">Reset Your Password</h1>
            <p style="color: #71717a; font-size: 16px; margin-bottom: 30px; line-height: 1.5;">
                We received a request to reset the password for your Tandem account. Click the button below to choose a new password.
            </p>
            <a href="{reset_link}" style="display: inline-block; background-color: #3ECF8E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 16px;">
                Reset Password
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 30px;">
                If you didn't request a password reset, you can safely ignore this email. This link will expire in 15 minutes.
            </p>
        </div>
      </body>
    </html>
    """

    # Use the configured 'from' email from settings, defaulting to onboarding@resend.dev
    from_email = settings.RESEND_FROM_EMAIL
    
    try:
        print(f"DEBUG: [RESEND] Attempting send: from={from_email}, to={to_email}, subject='Reset your Tandem Password'")
        params = {
            "from": from_email,
            "to": [to_email],
            "subject": "Reset your Tandem Password",
            "html": html,
        }
        response = resend.Emails.send(params)
        
        # Log the full response for diagnosis
        print(f"DEBUG: [RESEND] API Response: {response}")
        
        if "id" in response:
            print(f"DEBUG: [RESEND] Success! Message ID: {response['id']}")
            return {"success": True, "response": response, "error": None}
        else:
            print(f"DEBUG: [RESEND] API returned success but no ID found: {response}")
            return {"success": False, "response": response, "error": "No ID in response"}
            
    except Exception as e:
        error_msg = str(e)
        print(f"CRITICAL ERROR: [RESEND] Exception during email send: {error_msg}")
        
        # PROVIDE CLEARER CONTEXT FOR 403 FORBIDDEN
        if "403" in error_msg:
            print("IMPORTANT: Resend returned 403 Forbidden. This typically means:")
            print(f"1. You are in Sandbox mode and trying to send to a non-owner email ({to_email}).")
            print(f"2. Your 'from' address ({from_email}) is not from a verified domain.")
            print("3. Your API Key is invalid or restricted.")

        return {"success": False, "response": None, "error": error_msg}


@router.post("/debug/send-test-email")
async def send_test_email(to_email: str):
    """
    DEBUG ONLY: Manually trigger a test email via Resend to diagnose delivery issues.
    """
    print(f"DEBUG: Manual test email trigger for {to_email}")
    result = await asyncio.to_thread(send_reset_email_sync, to_email, "https://tandem.app/test-link")
    
    if result["success"]:
        return {
            "status": "success",
            "message": "Resend accepted the request",
            "api_response": result["response"]
        }
    else:
        return {
            "status": "error",
            "message": "Resend request failed",
            "error": result["error"],
            "api_response": result["response"]
        }


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    email_lower = data.email.lower()
    result = await db.execute(select(User).where(User.email == email_lower))
    user = result.scalar_one_or_none()
    
    if user:
        # Generate a short-lived token for password reset (15 minutes)
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        to_encode = {"sub": user.id, "type": "password_reset", "exp": expire}
        reset_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        # Build the reset link
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        print(f"DEBUG: Password reset link generated for {user.email}: {reset_link}")
        
        # Dispatch the email and AWAIT the result to ensure we catch API errors
        # Note: In production we might still return a generic success message,
        # but for debugging we need to know if the CALL itself failed.
        result = await asyncio.to_thread(send_reset_email_sync, user.email, reset_link)
        
        if not result["success"]:
            # If the CALL failed (e.g. invalid API key or domain), we should know
            print(f"ERROR: Failed to dispatch reset email to {user.email}: {result['error']}")
            # For debugging purposes, we'll raise an error here. 
            # In pure production, you might still want to return 200 to prevent enumeration,
            # but right now we are DEBUGGING why emails aren't arriving.
            raise HTTPException(
                status_code=500, 
                detail=f"Email delivery service failure: {result['error']}"
            )
    else:
        print(f"DEBUG: Password reset requested for non-existent email: {email_lower}")
    
    # Always return success if we got this far to prevent email enumeration
    return {"message": "If an account with that email exists, we have sent a password reset link."}


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token"
    )
    try:
        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "password_reset":
            print(f"DEBUG: Invalid token payload: user_id={user_id}, type={token_type}")
            raise credentials_exception
    except JWTError as e:
        print(f"DEBUG: JWT Decode Error during password reset: {e}")
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Hash the new password and save it
    user.hashed_password = hash_password(data.new_password)
    db.add(user)
    await db.commit()
    
    return {"message": "Password successfully reset"}
