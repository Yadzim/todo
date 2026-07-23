from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _add_column_if_missing(table: str, column: str, ddl: str) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    columns = {item["name"] for item in inspector.get_columns(table)}
    if column not in columns:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def init_db() -> None:
    # Import models so metadata is registered.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _add_column_if_missing("users", "name", "name VARCHAR(100) NOT NULL DEFAULT ''")
    _add_column_if_missing("users", "telegram_chat_id", "telegram_chat_id VARCHAR(64)")
    _add_column_if_missing("users", "telegram_link_token", "telegram_link_token VARCHAR(64)")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
