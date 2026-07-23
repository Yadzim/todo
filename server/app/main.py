from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, reminders, telegram, todos
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.telegram_poller import telegram_poller


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_scheduler()
    telegram_poller.start()
    yield
    await telegram_poller.stop()
    stop_scheduler()


init_db()

app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(todos.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
