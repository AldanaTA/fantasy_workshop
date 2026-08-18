from typing import Callable, Awaitable, Any
from redis.asyncio import Redis

from app.conf import settings
from app.helpers import json_dumps, json_loads

## SET and Get functions for caching JSON objects in Redis. 
# These functions handle serialization and deserialization of JSON data, as well as setting expiration times for cached items.
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

## Cache index functions for managing sets of cache keys in Redis. 
# These functions allow adding cache keys to an index and invalidating all cache keys associated with a specific index.
async def cache_index_add(r: Redis, index_key: str, cache_key: str, ttl_seconds: int):
    pipe = r.pipeline()
    pipe.sadd(index_key, cache_key)
    pipe.expire(index_key, ttl_seconds)
    await pipe.execute()

async def cache_index_invalidate(r: Redis, index_key: str):
    keys = await r.smembers(index_key)
    if keys:
        await r.delete(*list(keys))
    await r.delete(index_key)