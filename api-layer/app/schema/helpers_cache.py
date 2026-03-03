from typing import Callable, Awaitable, Any
from redis.asyncio import Redis
from app.conf import settings
from app.helpers import json_dumps, json_loads

async def cache_get_json(r: Redis, key: str):
    val = await r.get(key)
    if not val:
        return None
    try:
        return json_loads(val)
    except Exception:
        return None

async def cache_set_json(r: Redis, key: str, obj: Any, ttl: int | None = None):
    ttl = ttl if ttl is not None else settings.CACHE_DEFAULT_TTL_SECONDS
    await r.setex(key, ttl, json_dumps(obj))

async def cache_del_many(r: Redis, keys: list[str]):
    if keys:
        await r.delete(*keys)

# pattern: get-or-compute for JSON
async def cache_get_or_set_json(
    r: Redis,
    key: str,
    compute: Callable[[], Awaitable[Any]],
    ttl: int | None = None,
):
    cached = await cache_get_json(r, key)
    if cached is not None:
        return cached
    val = await compute()
    await cache_set_json(r, key, val, ttl=ttl)
    return val