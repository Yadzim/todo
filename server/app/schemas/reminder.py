from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    note: str | None = Field(default=None, max_length=2000)
    remind_at: datetime


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    note: str | None
    remind_at: datetime
    is_sent: bool
    sent_at: datetime | None
    created_at: datetime


class TelegramStatus(BaseModel):
    connected: bool
    bot_username: str | None = None
    deep_link: str | None = None
    bot_configured: bool
