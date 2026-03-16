from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models import User
from app.routes.auth import get_current_user
from app.schemas import UserOut
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])

class UserSearchResult(BaseModel):
    id: str
    name: str
    email: str
    avatar_color: str

@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    query: str, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    if len(query) < 2:
        return []
        
    search_pattern = f"%{query}%"
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user.id,
            or_(
                User.name.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
        .limit(10)
    )
    users = result.scalars().all()
    
    return [
        UserSearchResult(
            id=u.id,
            name=u.name,
            email=u.email,
            avatar_color=u.avatar_color
        ) for u in users
    ]
