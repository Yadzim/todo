from __future__ import annotations

import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.database import SessionLocal
from app.models.reminder import Reminder
from app.models.user import User
from app.services.telegram import send_message

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


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

            note_line = f"\n\n{reminder.note}" if reminder.note else ""
            text = f"⏰ <b>Eslatma</b>\n{reminder.title}{note_line}"
            ok = await send_message(user.telegram_chat_id, text)
            if ok:
                reminder.is_sent = True
                reminder.sent_at = datetime.now(UTC)
                db.commit()
            else:
                logger.warning("Reminder %s yuborilmadi", reminder.id)
    except Exception:
        logger.exception("Eslatmalarni yuborishda xatolik")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(process_due_reminders, "interval", seconds=30, id="reminders", replace_existing=True)
    scheduler.start()
    logger.info("Reminder scheduler ishga tushdi")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
