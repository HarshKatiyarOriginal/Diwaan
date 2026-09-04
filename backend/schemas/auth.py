from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: UUID | None = None
    tenant_id: UUID | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    tenant_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    tenant_id: UUID

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    id: UUID
    email: EmailStr
    tenant_id: UUID
    tenant_name: str


class UserProfileUpdate(BaseModel):
    tenant_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
