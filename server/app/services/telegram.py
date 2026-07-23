from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.pair_session import TelegramPairSession
from app.models.user import User

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"
PAIR_CODE_RE = re.compile(r"^[A-Z0-9]{8}$")


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


async def _handle_pair_login(chat_id: str, raw_text: str, db: Session) -> bool:
    code = raw_text.strip().upper().replace(" ", "")
    if not PAIR_CODE_RE.fullmatch(code):
        return False

    now = datetime.now(UTC)
    session = db.scalar(
        select(TelegramPairSession).where(
            TelegramPairSession.code == code,
            TelegramPairSession.confirmed.is_(False),
            TelegramPairSession.consumed.is_(False),
        )
    )
    if not session:
        await send_message(chat_id, "Kirish kodi noto‘g‘ri yoki allaqachon ishlatilgan.")
        return True

    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        await send_message(chat_id, "Kirish kodi muddati tugagan. Saytdan yangi kod oling.")
        return True

    user = db.scalar(select(User).where(User.telegram_chat_id == chat_id))
    if not user:
        await send_message(
            chat_id,
            "Bu Telegram hisobi Focus’ga ulanmagan.\n\n"
            "Avval saytda login qilib, «Eslatmalar → Telegramga ulash» ni bosing.",
        )
        return True

    session.user_id = user.id
    session.confirmed = True
    db.commit()

    await send_message(
        chat_id,
        f"✅ <b>{user.name}</b>, kirish tasdiqlandi.\n\n"
        "Saytga qayting — tizim avtomatik ochiladi.",
    )
    return True


async def handle_webhook_update(payload: dict, db: Session) -> None:
    message = payload.get("message") or payload.get("edited_message")
    if not message:
        return

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    if not chat_id:
        return

    text = message.get("text")
    start_token = _extract_start_token(text)
    if start_token is not None or (text and text.strip().startswith("/start")):
        if not start_token:
            await send_message(
                chat_id,
                "Focus botiga xush kelibsiz.\n\n"
                "• Hisobni ulash: saytdagi «Telegramga ulash»\n"
                "• Kirish: saytdagi kodni shu yerga yuboring",
            )
            return

        user = db.scalar(select(User).where(User.telegram_link_token == start_token))
        if not user:
            await send_message(
                chat_id,
                "Ulanish kodi noto‘g‘ri yoki muddati tugagan. Saytdan yangi havola oling.",
            )
            return

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
        return

    if text and await _handle_pair_login(chat_id, text, db):
        return

    await send_message(
        chat_id,
        "Focus botiga xush kelibsiz.\n\n"
        "• Hisobni ulash: saytdagi «Telegramga ulash»\n"
        "• Kirish: saytda ko‘rsatilgan 8 belgilik kodni shu yerga yuboring",
    )
