import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from sqlalchemy import text
from app.database import engine

async def query_db():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT count(*) FROM users"))
            print("Number of users:", result.scalar())
            result = await conn.execute(text("SELECT count(*) FROM groups"))
            print("Number of groups:", result.scalar())
            result = await conn.execute(text("SELECT email FROM users"))
            print("User emails:", [row[0] for row in result.fetchall()])
    except Exception as e:
        print("Error connecting to Supabase:", str(e))

asyncio.run(query_db())
