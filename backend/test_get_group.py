import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from app.database import engine, async_session
from app.models import Group, GroupMember, User
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_get_group():
    async with async_session() as db:
        try:
            group_id = '0910cc1d-807f-4ba7-8ac9-3332393c8df1'
            result = await db.execute(
                select(Group)
                .where(Group.id == group_id)
                .options(selectinload(Group.members).selectinload(GroupMember.user))
                .options(selectinload(Group.expenses))
            )
            group = result.scalar_one_or_none()
            print("Group found:", group.name if group else None)
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(test_get_group())
