from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.reminder import Reminder
from app.models.user import User
from app.schemas.reminder import ReminderCreate, ReminderOut

router = APIRouter(prefix="/reminders", tags=["reminders"])


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Reminder]:
    return list(
        db.scalars(
            select(Reminder)
            .where(Reminder.owner_id == current_user.id)
            .order_by(Reminder.remind_at.asc())
        ).all()
    )


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Reminder:
    if not current_user.telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avval Telegram botiga ulaning",
        )

    remind_at = _ensure_aware(payload.remind_at)
    if remind_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Eslatma vaqti kelajakda bo‘lishi kerak",
        )

    reminder = Reminder(
        title=payload.title.strip(),
        note=payload.note.strip() if payload.note else None,
        remind_at=remind_at,
        owner_id=current_user.id,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    reminder = db.get(Reminder, reminder_id)
    if not reminder or reminder.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eslatma topilmadi")
    db.delete(reminder)
    db.commit()
