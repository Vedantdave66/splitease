import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from sqlalchemy import text
from app.database import engine

async def list_tables():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            tables = [row[0] for row in result.fetchall()]
            print("Tables in Supabase:", tables)
    except Exception as e:
        print("Error connecting to Supabase:", str(e))

asyncio.run(list_tables())
