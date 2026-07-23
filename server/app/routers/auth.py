import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.login_code import TelegramLoginCode
from app.models.pair_session import TelegramPairSession
from app.models.user import User
from app.schemas.user import (
    TelegramLoginRequest,
    TelegramLoginRequestOut,
    TelegramLoginVerify,
    TelegramPairCreateOut,
    TelegramPairStatusOut,
    Token,
    UserCreate,
    UserOut,
)
from app.services.telegram import bot_configured, notify_login, send_message

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_CODE_TTL_MINUTES = 2
PAIR_CODE_TTL_MINUTES = 2
PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_pair_code() -> str:
    return "".join(secrets.choice(PAIR_CODE_ALPHABET) for _ in range(8))


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
    notify_login(user)
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

    return TelegramLoginRequestOut(
        message="Tasdiqlash kodi Telegram botiga yuborildi",
        expires_at=expires_at,
        expires_in=LOGIN_CODE_TTL_MINUTES * 60,
    )


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
    notify_login(user)
    return Token(access_token=create_access_token(user.id))


@router.post("/telegram/pair", response_model=TelegramPairCreateOut)
def create_telegram_pair(db: Session = Depends(get_db)) -> TelegramPairCreateOut:
    if not bot_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot sozlanmagan",
        )

    expires_at = datetime.now(UTC) + timedelta(minutes=PAIR_CODE_TTL_MINUTES)
    code = _generate_pair_code()
    # Collision juda kam, lekin unique bo‘lishi uchun bir necha urinish.
    for _ in range(5):
        exists = db.scalar(select(TelegramPairSession.id).where(TelegramPairSession.code == code))
        if not exists:
            break
        code = _generate_pair_code()

    session = TelegramPairSession(code=code, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)

    username = settings.telegram_bot_username.lstrip("@") if settings.telegram_bot_username else None
    return TelegramPairCreateOut(
        session_id=session.id,
        code=session.code,
        expires_at=expires_at,
        expires_in=PAIR_CODE_TTL_MINUTES * 60,
        bot_username=username,
        bot_link=f"https://t.me/{username}" if username else None,
    )


@router.get("/telegram/pair/{session_id}", response_model=TelegramPairStatusOut)
def get_telegram_pair_status(session_id: str, db: Session = Depends(get_db)) -> TelegramPairStatusOut:
    session = db.get(TelegramPairSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessiya topilmadi")

    now = datetime.now(UTC)
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)

    if session.consumed:
        return TelegramPairStatusOut(status="consumed")

    if not session.confirmed and expires < now:
        return TelegramPairStatusOut(status="expired")

    if not session.confirmed:
        return TelegramPairStatusOut(status="pending")

    if not session.user_id:
        return TelegramPairStatusOut(status="pending")

    user = db.get(User, session.user_id)
    token = create_access_token(session.user_id)
    session.consumed = True
    db.commit()
    if user:
        notify_login(user)
    return TelegramPairStatusOut(status="confirmed", access_token=token, token_type="bearer")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
