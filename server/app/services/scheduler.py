from __future__ import annotations

import html
import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from app.database import SessionLocal
from app.models.reminder import Reminder
from app.models.user import User
from app.services.telegram import send_message

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
TZ = ZoneInfo("Asia/Tashkent")


def _format_remind_at(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(TZ).strftime("%d.%m.%Y %H:%M")


def _build_message(reminder: Reminder) -> str:
    when = _format_remind_at(reminder.remind_at)
    title = html.escape(reminder.title)
    note = html.escape(reminder.note) if reminder.note else None
    text = f"⏰ <b>Eslatma</b> ({when})\n\n<b>{title}</b>"
    if note:
        text += f"\n\n{note}"
    return text


async def process_due_reminders() -> None:
    now = datetime.now(UTC)
    db = SessionLocal()
    try:
        reminders = list(
            db.scalars(
                select(Reminder)
                .where(Reminder.is_sent.is_(False), Reminder.remind_at <= now)
                .order_by(Reminder.remind_at.asc())
                .limit(50)
            ).all()
        )

        for reminder in reminders:
            user = db.get(User, reminder.owner_id)
            if not user or not user.telegram_chat_id:
                continue

            # Avval band qilamiz — parallel joblar ikki marta yubormasligi uchun.
            claimed = db.execute(
                update(Reminder)
                .where(Reminder.id == reminder.id, Reminder.is_sent.is_(False))
                .values(is_sent=True, sent_at=now)
            )
            db.commit()
            if claimed.rowcount == 0:
                continue

            ok = await send_message(user.telegram_chat_id, _build_message(reminder))
            if not ok:
                db.execute(
                    update(Reminder)
                    .where(Reminder.id == reminder.id)
                    .values(is_sent=False, sent_at=None)
                )
                db.commit()
                logger.warning("Reminder %s yuborilmadi, qayta urinish uchun ochildi", reminder.id)
    except Exception:
        logger.exception("Eslatmalarni yuborishda xatolik")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        process_due_reminders,
        "interval",
        seconds=30,
        id="reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Reminder scheduler ishga tushdi")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
