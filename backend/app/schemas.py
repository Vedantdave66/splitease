from datetime import datetime
from pydantic import BaseModel, EmailStr


# --- Auth ---
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_color: str
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
    total_expenses: float = 0

    class Config:
        from_attributes = True


class GroupListOut(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    member_count: int = 0
    total_expenses: float = 0

    class Config:
        from_attributes = True


# --- Expenses ---
class ExpenseCreate(BaseModel):
    title: str
    amount: float
    paid_by: str
    participant_ids: list[str]
    split_type: str = "equal"


class ExpenseParticipantOut(BaseModel):
    user_id: str
    name: str
    share_amount: float
    avatar_color: str = "#3ECF8E"

    class Config:
        from_attributes = True


class ExpenseOut(BaseModel):
    id: str
    title: str
    amount: float
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
    total_paid: float
    total_owed: float
    net_balance: float


class Settlement(BaseModel):
    from_user_id: str
    from_user_name: str
    from_avatar_color: str
    to_user_id: str
    to_user_name: str
    to_avatar_color: str
    amount: float
