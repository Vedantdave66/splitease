import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Numeric, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_color: Mapped[str] = mapped_column(String(7), default="#3ECF8E")
    wallet_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), default=Decimal('0.00'))
    interac_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    groups: Mapped[list["GroupMember"]] = relationship(back_populates="user")
    expenses_paid: Mapped[list["Expense"]] = relationship(back_populates="payer")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["GroupMember"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    settlement_records: Mapped[list["SettlementRecord"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    creator: Mapped["User"] = relationship()


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped["Group"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="groups")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), nullable=False)
    paid_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    split_type: Mapped[str] = mapped_column(String(20), default="equal")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped["Group"] = relationship(back_populates="expenses")
    payer: Mapped["User"] = relationship(back_populates="expenses_paid")
    participants: Mapped[list["ExpenseParticipant"]] = relationship(back_populates="expense", cascade="all, delete-orphan")


class ExpenseParticipant(Base):
    __tablename__ = "expense_participants"

    expense_id: Mapped[str] = mapped_column(String, ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    share_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), nullable=False)

    expense: Mapped["Expense"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()


# --- Settlement Records ---
class SettlementRecord(Base):
    """Tracks actual payment transactions between users within a group."""
    __tablename__ = "settlement_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    payer_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    payee_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), nullable=False)
    method: Mapped[str] = mapped_column(String(20), default="etransfer")  # in_app | etransfer
    status: Mapped[str] = mapped_column(String(20), default="pending")    # pending | sent | settled | declined
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    group: Mapped["Group"] = relationship(back_populates="settlement_records")
    payer: Mapped["User"] = relationship(foreign_keys=[payer_id])
    payee: Mapped["User"] = relationship(foreign_keys=[payee_id])


# --- Notifications ---
class Notification(Base):
    """In-app notification for group activity events."""
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False)  # expense_added, settlement_requested, payment_sent, payment_confirmed, member_added
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # group_id or settlement_id
    group_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


# --- Friend Requests ---
class FriendRequest(Base):
    """Tracks friend requests sent via email."""
    __tablename__ = "friend_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    receiver_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | declined
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sender: Mapped["User"] = relationship()


# --- Fintech Platform Overhaul: Providers, Ledger, and Payment Requests ---

class ProviderAccount(Base):
    """Represents a linked bank account via an external provider (e.g., Plaid)."""
    __tablename__ = "provider_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), default="plaid")
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    account_mask: Mapped[str] = mapped_column(String(4), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="linked")  # linked | relink_required | verification_required | removed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship()


class WalletTransaction(Base):
    """The internal ledger representing all money movement in and out of user wallets."""
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # deposit | withdrawal | transfer_in | transfer_out
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending | completed | failed
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # payment_request | deposit | withdrawal | settlement
    reference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # link to a payment_request, provider_account, etc.
    stripe_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()


class PaymentRequest(Base):
    """Tracks direct peer-to-peer money requests within groups."""
    __tablename__ = "payment_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    requester_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    payer_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2, asdecimal=True), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending | awaiting_payment | processing | settled | failed | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    group: Mapped["Group"] = relationship()
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    payer: Mapped["User"] = relationship(foreign_keys=[payer_id])
