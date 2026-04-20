from pydantic import BaseModel
import os

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    JWT_ISSUER: str = os.getenv("JWT_ISSUER", "ttrpg-api")
    JWT_AUDIENCE: str = os.getenv("JWT_AUDIENCE", "ttrpg-app")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-change-me")
    JWT_ALG: str = os.getenv("JWT_ALG", "HS256")

    ACCESS_TOKEN_TTL_SECONDS: int = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", "900"))          # 15m
    REFRESH_TOKEN_TTL_SECONDS: int = int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", "2592000"))    # 30d

    CACHE_DEFAULT_TTL_SECONDS: int = int(os.getenv("CACHE_DEFAULT_TTL_SECONDS", "30"))
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

settings = Settings()
