import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.login_code import TelegramLoginCode
from app.models.user import User
from app.schemas.user import (
    TelegramLoginRequest,
    TelegramLoginRequestOut,
    TelegramLoginVerify,
    Token,
    UserCreate,
    UserOut,
)
from app.services.telegram import bot_configured, send_message

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_CODE_TTL_MINUTES = 5


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email allaqachon ro'yxatdan o'tgan",
        )

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    user = db.scalar(select(User).where(User.email == form_data.username.lower()))
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email yoki parol noto'g'ri",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(user.id))


@router.post("/telegram/request", response_model=TelegramLoginRequestOut)
async def request_telegram_login(
    payload: TelegramLoginRequest,
    db: Session = Depends(get_db),
) -> TelegramLoginRequestOut:
    if not bot_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot sozlanmagan",
        )

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email topilmadi")

    if not user.telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu hisob Telegram botiga ulanmagan",
        )

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(UTC) + timedelta(minutes=LOGIN_CODE_TTL_MINUTES)

    # Eski kodlarni bekor qilamiz.
    db.execute(
        update(TelegramLoginCode)
        .where(TelegramLoginCode.user_id == user.id, TelegramLoginCode.used.is_(False))
        .values(used=True)
    )
    db.add(TelegramLoginCode(user_id=user.id, code=code, expires_at=expires_at))
    db.commit()

    ok = await send_message(
        user.telegram_chat_id,
        f"🔐 <b>Kirish kodi</b>\n\n"
        f"<b>{code}</b>\n\n"
        f"Kod {LOGIN_CODE_TTL_MINUTES} daqiqa amal qiladi.\n"
        f"Agar bu siz bo‘lmasangiz — e’tiborsiz qoldiring.",
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kod Telegramga yuborilmadi. Keyinroq urinib ko‘ring.",
        )

    return TelegramLoginRequestOut(message="Tasdiqlash kodi Telegram botiga yuborildi")


@router.post("/telegram/verify", response_model=Token)
def verify_telegram_login(
    payload: TelegramLoginVerify,
    db: Session = Depends(get_db),
) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email topilmadi")

    now = datetime.now(UTC)
    record = db.scalar(
        select(TelegramLoginCode)
        .where(
            TelegramLoginCode.user_id == user.id,
            TelegramLoginCode.code == payload.code.strip(),
            TelegramLoginCode.used.is_(False),
            TelegramLoginCode.expires_at >= now,
        )
        .order_by(TelegramLoginCode.created_at.desc())
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kod noto‘g‘ri yoki muddati tugagan",
        )

    record.used = True
    db.commit()
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
