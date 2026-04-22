import asyncio
from app.database import engine, Base
import app.models # Ensure models are registered

async def init():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created!")

asyncio.run(init())
