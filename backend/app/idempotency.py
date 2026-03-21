"""
Idempotency infrastructure for payment-critical endpoints.

Race-condition-safe implementation:
  1. SELECT existing key → fast path for sequential retries
  2. If not found → execute handler → INSERT result
  3. UniqueConstraint on (key, user_id, endpoint) catches concurrent races:
     - If INSERT fails (IntegrityError) → another request won → return error
     - The row-level locks on User rows ALREADY serialize concurrent mutations
     - So the idempotency layer only needs to prevent duplicate SUCCESS records

Security enforcements:
  - SHA-256 hash of request body stored alongside key
  - Same key + different payload → HTTP 422 rejection
  - TTL is 24h for cleanup, correctness doesn't depend on it

Usage:
    @router.post("/some-endpoint")
    @idempotent
    async def handler(request: Request, db: AsyncSession = Depends(get_db), ...):
        ...
"""

import json
import hashlib
import datetime
import uuid
import functools
import logging
from typing import Callable

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import String, DateTime, Integer, func, select, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.database import Base

logger = logging.getLogger("splitease.idempotency")


class IdempotencyKey(Base):
    """Stores idempotency keys, request hashes, and cached responses."""
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("key", "user_id", "endpoint", name="uq_idempotency_key_user_endpoint"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


IDEMPOTENCY_TTL = datetime.timedelta(hours=24)


def _compute_request_hash(body_bytes: bytes) -> str:
    """Compute a deterministic SHA-256 hash of the raw request body."""
    return hashlib.sha256(body_bytes).hexdigest()


def idempotent(fn: Callable) -> Callable:
    """
    Decorator that adds race-condition-safe idempotency to a FastAPI route handler.

    Algorithm:
      1. SELECT existing key (handles sequential retries — common case)
         - Found + same hash → return cached response
         - Found + different hash → HTTP 422
      2. If not found → execute handler
      3. INSERT result with UniqueConstraint protection
         - If INSERT succeeds → response committed with business data
         - If INSERT fails (concurrent race) → business data + idempotency record
           are rolled back together → client retries safely

    Why this is safe for concurrent races:
      The business operations (wallet mutations) use row-level locks (SELECT FOR UPDATE)
      which serialize concurrent requests at the DB level. So even if two concurrent
      requests with the same key both pass the SELECT check, the second one will:
        - Either block on the user lock until the first commits
        - Then its INSERT will fail (UniqueConstraint) → entire transaction rolls back
        - Client retries → SELECT finds the committed record → cached response returned
    """

    @functools.wraps(fn)
    async def wrapper(*args, **kwargs):
        request: Request = kwargs.get("request")
        db: AsyncSession = kwargs.get("db")

        if request is None or db is None:
            return await fn(*args, **kwargs)

        idem_key = request.headers.get("Idempotency-Key")
        if not idem_key:
            return await fn(*args, **kwargs)

        current_user = kwargs.get("current_user")
        user_id = current_user.id if current_user and hasattr(current_user, "id") else "anonymous"
        endpoint = f"{request.method} {request.url.path}"
        body_bytes = await request.body()
        request_hash = _compute_request_hash(body_bytes)
        correlation_id = idem_key[:12]

        # ──────────────────────────────────────────
        # STEP 1: Check for existing key (fast path)
        # ──────────────────────────────────────────
        cutoff = datetime.datetime.now(datetime.timezone.utc) - IDEMPOTENCY_TTL
        result = await db.execute(
            select(IdempotencyKey).where(
                IdempotencyKey.key == idem_key,
                IdempotencyKey.user_id == user_id,
                IdempotencyKey.endpoint == endpoint,
                IdempotencyKey.created_at > cutoff,
            )
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            # Payload consistency check
            if existing.request_hash != request_hash:
                logger.warning(
                    f"[{correlation_id}] IDEMPOTENCY CONFLICT: key={idem_key} "
                    f"endpoint={endpoint} — same key, different payload"
                )
                raise HTTPException(
                    status_code=422,
                    detail="Idempotency key already used with a different request payload. "
                           "Use a new key for a different request.",
                )

            # Return cached response
            logger.info(f"[{correlation_id}] Idempotent cache hit — returning cached response")
            return JSONResponse(
                status_code=existing.response_code,
                content=json.loads(existing.response_body),
            )

        # ──────────────────────────────────────────
        # STEP 2: Execute the handler
        # ──────────────────────────────────────────
        logger.info(
            f"[{correlation_id}] Idempotent key accepted: key={idem_key} "
            f"endpoint={endpoint} user={user_id} — executing handler"
        )

        response = await fn(*args, **kwargs)

        # ──────────────────────────────────────────
        # STEP 3: INSERT the idempotency record
        # Committed atomically with the business data
        # UniqueConstraint catches concurrent races
        # ──────────────────────────────────────────

        # Serialize the response for caching
        if hasattr(response, "model_dump"):
            body = response.model_dump(mode="json")
        elif isinstance(response, dict):
            body = response
        elif isinstance(response, JSONResponse):
            body = json.loads(response.body.decode("utf-8"))
        elif hasattr(response, "__table__"):
            # SQLAlchemy model — serialize column values
            from sqlalchemy import inspect as sa_inspect
            mapper = sa_inspect(type(response))
            body = {}
            for col in mapper.columns:
                val = getattr(response, col.key, None)
                if isinstance(val, datetime.datetime):
                    body[col.key] = val.isoformat()
                else:
                    body[col.key] = val
        elif hasattr(response, "dict"):
            body = response.dict()
        elif hasattr(response, "__dict__"):
            body = {k: v for k, v in response.__dict__.items() if not k.startswith("_")}
        else:
            # Can't serialize — still add the record with a minimal body
            body = {"_unserialized": True}

        record = IdempotencyKey(
            key=idem_key,
            user_id=user_id,
            endpoint=endpoint,
            request_hash=request_hash,
            response_code=200,
            response_body=json.dumps(body, default=str),
        )
        db.add(record)
        # Record is committed with the business transaction by get_db.
        # If a concurrent race causes IntegrityError at commit time,
        # the ENTIRE transaction (business + idempotency) rolls back.
        # The client retries and the SELECT in step 1 returns the cached response.

        logger.info(f"[{correlation_id}] Idempotent response cached: key={idem_key}")
        return response

    return wrapper
