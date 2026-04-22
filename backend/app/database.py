from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.effective_database_url, 
    echo=False,
    poolclass=NullPool
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """
    Yields an async database session.

    Transaction strategy:
      - The session does NOT auto-commit. Routes are responsible for calling
        `await db.flush()` to send changes to the DB within the transaction,
        and the session commits when it closes successfully.
      - On exception, the session rolls back automatically.

    This gives payment-critical routes explicit control over their
    transaction boundaries while keeping non-critical routes simple.
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
