from datetime import datetime
from decimal import Decimal
from pydantic import condecimal
from pydantic import BaseModel, EmailStr


# --- Auth ---
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    interac_email: EmailStr | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_color: str
    wallet_balance: Decimal = 0.0
    interac_email: str | None = None
    stripe_account_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Groups ---
class GroupCreate(BaseModel):
    name: str


class MemberAdd(BaseModel):
    email: EmailStr


class GroupMemberOut(BaseModel):
    user_id: str
    name: str
    email: str
    avatar_color: str

    class Config:
        from_attributes = True


class GroupOut(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    members: list[GroupMemberOut] = []
    total_expenses: Decimal = 0

    class Config:
        from_attributes = True


class GroupListOut(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    member_count: int = 0
    total_expenses: Decimal = 0

    class Config:
        from_attributes = True


# --- Expenses ---
class ExpenseCreate(BaseModel):
    title: str
    amount: Decimal
    paid_by: str
    participant_ids: list[str]
    split_type: str = "equal"


class ExpenseParticipantOut(BaseModel):
    user_id: str
    name: str
    share_amount: Decimal
    avatar_color: str = "#3ECF8E"

    class Config:
        from_attributes = True


class ExpenseOut(BaseModel):
    id: str
    title: str
    amount: Decimal
    paid_by: str
    payer_name: str = ""
    payer_avatar_color: str = "#3ECF8E"
    split_type: str
    created_at: datetime
    participants: list[ExpenseParticipantOut] = []

    class Config:
        from_attributes = True


# --- Balances & Settlements ---
class UserBalance(BaseModel):
    user_id: str
    name: str
    avatar_color: str
    total_paid: Decimal
    total_owed: Decimal
    net_balance: Decimal


class Settlement(BaseModel):
    from_user_id: str
    from_user_name: str
    from_user_email: str
    from_avatar_color: str
    to_user_id: str
    to_user_name: str
    to_user_email: str
    to_avatar_color: str
    amount: Decimal


# --- Settlement Records (actual payment tracking) ---
class SettlementRecordCreate(BaseModel):
    payee_id: str
    amount: Decimal
    method: str = "etransfer"  # in_app | etransfer


class SettlementRecordOut(BaseModel):
    id: str
    group_id: str
    payer_id: str
    payer_name: str
    payer_email: str
    payer_avatar_color: str
    payee_id: str
    payee_name: str
    payee_email: str
    payee_avatar_color: str
    amount: Decimal
    method: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SettlementStatusUpdate(BaseModel):
    status: str  # sent | settled | declined


# --- Notifications ---
class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    read: bool
    reference_id: str | None = None
    group_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Friend Requests ---
class FriendRequestCreate(BaseModel):
    email: EmailStr


class FriendRequestOut(BaseModel):
    id: str
    sender_id: str
    receiver_email: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Optional nested data for the frontend
    sender_name: str | None = None
    sender_avatar: str | None = None
    sender_email: str | None = None

    class Config:
        from_attributes = True


# --- Fintech Platform Overhaul: Providers & Ledger ---

class ProviderAccountOut(BaseModel):
    id: str
    user_id: str
    provider: str
    account_mask: str
    institution_name: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WalletTransactionOut(BaseModel):
    id: str
    user_id: str
    type: str
    amount: Decimal
    status: str
    reference_id: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class PaymentRequestCreate(BaseModel):
    payer_id: str
    amount: Decimal
    note: str | None = None
    due_date: datetime | None = None


class PaymentRequestOut(BaseModel):
    id: str
    group_id: str
    requester_id: str
    payer_id: str
    amount: Decimal
    note: str | None = None
    due_date: datetime | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Nested display data
    requester_name: str | None = None
    requester_avatar: str | None = None
    payer_name: str | None = None
    payer_avatar: str | None = None

    class Config:
        from_attributes = True


# --- Expense Reminders ---
class ReminderCreate(BaseModel):
    interval_days: int  # minimum 1


class ReminderOut(BaseModel):
    id: str
    expense_id: str
    created_by: str
    interval_days: int
    next_reminder_at: datetime
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
