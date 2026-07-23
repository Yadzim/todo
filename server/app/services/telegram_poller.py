from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import settings
from app.database import SessionLocal
from app.services.telegram import handle_webhook_update

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"


class TelegramPoller:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stopped = asyncio.Event()

    def start(self) -> None:
        if not settings.telegram_bot_token or not settings.telegram_polling:
            return
        if self._task and not self._task.done():
            return
        self._stopped.clear()
        self._task = asyncio.create_task(self._run(), name="telegram-poller")
        logger.info("Telegram polling ishga tushdi")

    async def stop(self) -> None:
        self._stopped.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        offset = 0
        url = f"{TELEGRAM_API}/bot{settings.telegram_bot_token}/getUpdates"
        async with httpx.AsyncClient(timeout=40) as client:
            while not self._stopped.is_set():
                try:
                    response = await client.get(
                        url,
                        params={"offset": offset, "timeout": 25},
                    )
                    data = response.json()
                    if not data.get("ok"):
                        await asyncio.sleep(3)
                        continue
                    for update in data.get("result", []):
                        offset = max(offset, int(update["update_id"]) + 1)
                        db = SessionLocal()
                        try:
                            await handle_webhook_update(update, db)
                        finally:
                            db.close()
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Telegram polling xatosi")
                    await asyncio.sleep(3)


telegram_poller = TelegramPoller()
