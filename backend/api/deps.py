from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Annotated
from uuid import UUID

from ..db.session import get_db
from ..core.security import decode_access_token
from ..core.exceptions import APIError
from ..models.user import User
from ..schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_access_token(token)
    user_id_str = payload.get("user_id")
    tenant_id_str = payload.get("tenant_id")
    
    if user_id_str is None or tenant_id_str is None:
        raise APIError("Could not validate credentials", status_code=401)
        
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise APIError("Invalid user format in token", status_code=401)
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise APIError("User not found", status_code=401)
        
    return user
