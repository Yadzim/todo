from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Todo API"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./todo.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    class Config:
        env_file = ".env"


settings = Settings()
