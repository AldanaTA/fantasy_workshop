from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from redis.asyncio import Redis
from app.conf import settings

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session

async def get_redis() -> Redis:
    yield redis_client