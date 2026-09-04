from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm

from ..db.session import get_db
from ..models.user import User, Tenant
from ..schemas.auth import UserCreate, Token, UserResponse, UserProfileResponse, UserProfileUpdate
from ..core.security import get_password_hash, verify_password, create_access_token
from ..core.exceptions import APIError
from .deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise APIError("Email already registered", status_code=400)

    tenant = Tenant(name=user_in.tenant_name)
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

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


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    tenant_name = tenant.name if tenant else "Default Tenant"

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        tenant_id=current_user.tenant_id,
        tenant_name=tenant_name
    )


@router.patch("/me", response_model=UserProfileResponse)
async def update_user_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Tenant name update
    if profile_in.tenant_name:
        tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = tenant_res.scalar_one_or_none()
        if tenant:
            tenant.name = profile_in.tenant_name.strip()

    # Password change update
    if profile_in.new_password:
        if not profile_in.current_password:
            raise APIError("Current password is required to set a new password", status_code=400)
        if not verify_password(profile_in.current_password, current_user.hashed_password):
            raise APIError("Incorrect current password", status_code=400)
        if len(profile_in.new_password) < 6:
            raise APIError("New password must be at least 6 characters", status_code=400)
        current_user.hashed_password = get_password_hash(profile_in.new_password)

    await db.commit()
    await db.refresh(current_user)

    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    tenant_name = tenant.name if tenant else "Default Tenant"

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        tenant_id=current_user.tenant_id,
        tenant_name=tenant_name
    )
