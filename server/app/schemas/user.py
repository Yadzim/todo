from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None


class TelegramLoginRequest(BaseModel):
    email: EmailStr


class TelegramLoginVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TelegramLoginRequestOut(BaseModel):
    message: str
    expires_at: datetime
    expires_in: int


class TelegramPairCreateOut(BaseModel):
    session_id: str
    code: str
    expires_at: datetime
    expires_in: int
    bot_username: str | None = None
    bot_link: str | None = None


class TelegramPairStatusOut(BaseModel):
    status: str
    access_token: str | None = None
    token_type: str | None = None
