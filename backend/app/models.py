import uuid
from datetime import datetime
from sqlalchemy import String, Float, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_color: Mapped[str] = mapped_column(String(7), default="#3ECF8E")
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
    amount: Mapped[float] = mapped_column(Float, nullable=False)
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
    share_amount: Mapped[float] = mapped_column(Float, nullable=False)

    expense: Mapped["Expense"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()
