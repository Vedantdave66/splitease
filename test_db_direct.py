import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Test the pooler URL on port 5432 (Session mode / Direct connection)
URL = "postgresql+psycopg://postgres.gazgcmcvcajxqnxlwjmv:MessiwonWC2022$@aws-1-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=require"

async def test_pooler_5432():
    print("Testing pooler port 5432 connection...")
    engine = create_async_engine(URL, echo=True)
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1"))
            print("Connection successful! Result:", res.scalar())
    except Exception as e:
        print("Connection failed:", type(e), e)

asyncio.run(test_pooler_5432())
