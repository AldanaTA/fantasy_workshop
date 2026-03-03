import time
from redis.asyncio import Redis
from fastapi import HTTPException

_LUA_TOKEN_BUCKET = """
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local burst = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local tokens = redis.call("HGET", key, "tokens")
local last = redis.call("HGET", key, "last")

if tokens == false then
  tokens = burst
  last = now
else
  tokens = tonumber(tokens)
  last = tonumber(last)
end

local delta = now - last
if delta < 0 then delta = 0 end
tokens = math.min(burst, tokens + (delta * rate))
last = now

local allowed = 0
local retry_after = 0

if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  allowed = 0
  local missing = cost - tokens
  if rate > 0 then
    retry_after = missing / rate
  else
    retry_after = 1
  end
end

redis.call("HSET", key, "tokens", tokens, "last", last)
redis.call("EXPIRE", key, 3600)

return {allowed, tokens, retry_after}
"""

async def rate_limit_or_429(
    r: Redis,
    key: str,
    *,
    rate_per_sec: float,
    burst: float,
    cost: float = 1.0,
):
    now = time.time()
    allowed, _tokens, retry_after = await r.eval(
        _LUA_TOKEN_BUCKET,
        numkeys=1,
        keys=[key],
        args=[rate_per_sec, burst, cost, now],
    )
    if int(allowed) != 1:
        ra = max(1, int(float(retry_after) + 0.999))
        raise HTTPException(
            status_code=429,
            detail="rate limit exceeded",
            headers={"Retry-After": str(ra)},
        )