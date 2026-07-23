from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"


def bot_configured() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_bot_username)


def deep_link_for_token(token: str) -> str | None:
    if not settings.telegram_bot_username:
        return None
    return f"https://t.me/{settings.telegram_bot_username.lstrip('@')}?start={token}"


async def send_message(chat_id: str, text: str) -> bool:
    if not settings.telegram_bot_token:
        logger.warning("Telegram bot token sozlanmagan")
        return False

    url = f"{TELEGRAM_API}/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        )
        if response.status_code >= 400:
            logger.error("Telegram xabar yuborilmadi: %s", response.text)
            return False
        return True


def _extract_start_token(text: str | None) -> str | None:
    if not text:
        return None
    parts = text.strip().split(maxsplit=1)
    if not parts or parts[0] != "/start":
        return None
    if len(parts) == 1:
        return None
    return parts[1].strip() or None


async def handle_webhook_update(payload: dict, db: Session) -> None:
    message = payload.get("message") or payload.get("edited_message")
    if not message:
        return

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    if not chat_id:
        return

    token = _extract_start_token(message.get("text"))
    if not token:
        await send_message(
            chat_id,
            "Focus botiga xush kelibsiz.\n\n"
            "Hisobni ulash uchun saytdagi «Telegramga ulash» tugmasini bosing.",
        )
        return

    user = db.scalar(select(User).where(User.telegram_link_token == token))
    if not user:
        await send_message(chat_id, "Ulanish kodi noto‘g‘ri yoki muddati tugagan. Saytdan yangi havola oling.")
        return

    # Agar shu chat boshqa userga bog‘langan bo‘lsa — uzamiz.
    other = db.scalar(select(User).where(User.telegram_chat_id == chat_id, User.id != user.id))
    if other:
        other.telegram_chat_id = None

    user.telegram_chat_id = chat_id
    user.telegram_link_token = None
    db.commit()

    await send_message(
        chat_id,
        f"Salom, <b>{user.name}</b>!\n\n"
        "Telegram hisobingiz Focus bilan ulandi.\n"
        "Endi saytda eslatmali notelar qo‘shishingiz mumkin.",
    )
