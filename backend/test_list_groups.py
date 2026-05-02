import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from app.database import engine, async_session
from app.models import Group, GroupMember, User
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_list_groups():
    async with async_session() as db:
        try:
            # Get the user ID from the database for vedantdave9@gmail.com
            user_res = await db.execute(select(User).where(User.email == "vedantdave9@gmail.com"))
            user = user_res.scalar_one_or_none()
            if not user:
                print("User not found")
                return

            print("Testing list_groups for user:", user.id)
            
            member_q = select(GroupMember.group_id).where(GroupMember.user_id == user.id)
            result = await db.execute(
                select(Group)
                .where(Group.id.in_(member_q))
                .options(selectinload(Group.members))
                .options(selectinload(Group.expenses))
                .order_by(Group.created_at.desc())
            )
            groups = result.scalars().all()
            print("Groups found:", len(groups))
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(test_list_groups())
