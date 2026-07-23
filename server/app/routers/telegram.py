import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.reminder import TelegramStatus
from app.services.telegram import bot_configured, deep_link_for_token, handle_webhook_update

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.get("/status", response_model=TelegramStatus)
def telegram_status(current_user: User = Depends(get_current_user)) -> TelegramStatus:
    configured = bot_configured()
    connected = bool(current_user.telegram_chat_id)
    deep_link = None
    if configured and current_user.telegram_link_token and not connected:
        deep_link = deep_link_for_token(current_user.telegram_link_token)

    return TelegramStatus(
        connected=connected,
        bot_username=settings.telegram_bot_username or None,
        deep_link=deep_link,
        bot_configured=configured,
    )


@router.post("/link", response_model=TelegramStatus)
def create_telegram_link(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TelegramStatus:
    if not bot_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot sozlanmagan. Admin TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME qo‘shishi kerak.",
        )

    if current_user.telegram_chat_id:
        return TelegramStatus(
            connected=True,
            bot_username=settings.telegram_bot_username,
            deep_link=None,
            bot_configured=True,
        )

    token = secrets.token_urlsafe(16)
    current_user.telegram_link_token = token
    db.commit()
    db.refresh(current_user)

    return TelegramStatus(
        connected=False,
        bot_username=settings.telegram_bot_username,
        deep_link=deep_link_for_token(token),
        bot_configured=True,
    )


@router.delete("/unlink", response_model=TelegramStatus)
def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TelegramStatus:
    current_user.telegram_chat_id = None
    current_user.telegram_link_token = None
    db.commit()
    return TelegramStatus(
        connected=False,
        bot_username=settings.telegram_bot_username or None,
        deep_link=None,
        bot_configured=bot_configured(),
    )


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    if settings.telegram_webhook_secret:
        if x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    payload = await request.json()
    await handle_webhook_update(payload, db)
    return {"ok": True}
