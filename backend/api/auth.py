from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm

from ..db.session import get_db
from ..models.user import User, Tenant
from ..schemas.auth import UserCreate, Token, UserResponse
from ..core.security import get_password_hash, verify_password, create_access_token
from ..core.exceptions import APIError

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise APIError("Email already registered", status_code=400)
        
    # Create Tenant first
    tenant = Tenant(name=user_in.tenant_name)
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    
    # Create User
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        tenant_id=tenant.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise APIError("Incorrect email or password", status_code=401)
        
    access_token = create_access_token(
        data={"user_id": str(user.id), "tenant_id": str(user.tenant_id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}
