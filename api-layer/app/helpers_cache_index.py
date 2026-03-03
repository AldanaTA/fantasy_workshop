from redis.asyncio import Redis

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