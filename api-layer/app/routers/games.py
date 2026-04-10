from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists
from uuid import UUID
from redis.asyncio import Redis

from app.helpers import require_user, new_id
from app.schema.db import get_db, get_redis
from app.schema.models import Game, UserGameRole
from app.schema.schemas import GameCreate, GameOut
from app.helpers_rate_limit import rate_limit_or_429

router = APIRouter(prefix="/games", tags=["games"])

# ---- CREATE ----
@router.post("", response_model=GameOut)
async def create_game(
    game: GameCreate,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    obj = Game(**game.model_dump(), owner_user_id=user.id)
    obj.id = new_id()
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

# --- Public game listing ---
@router.get("/public", response_model=list[GameOut])
async def list_public_games(
    limit: int = 50,
    offset: int = 0,
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    await rate_limit_or_429(redis, f"rl:games:list_public", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game).where(Game.visibility == "public").limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())

# -- Owned game listing ---
@router.get("/owned", response_model=list[GameOut])
async def list_owned_games(
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    await rate_limit_or_429(redis, f"rl:games:list_owned:{user.id}", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game).where(Game.owner_user_id == user.id).limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())

# -- purchased game listing ---
@router.get("/purchased", response_model=list[GameOut])
async def list_purchased_games( 
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    await rate_limit_or_429(redis, f"rl:games:list_purchased:{user.id}", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game).where(
        exists().where(UserGameRole.user_id == user.id, UserGameRole.game_id == Game.id, UserGameRole.role == "purchaser")
    ).limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())

# ---- GET ONE ----
@router.get("/{id}", response_model=GameOut)
async def get_game(
    id: UUID,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    await rate_limit_or_429(redis, f"rl:games:get:{user.id}", rate_per_sec=10/60, burst=20)
    game = await db.get(Game, id)
    if not game:
        raise HTTPException(404, "Game not found")
    has_role = await db.scalar(
        select(exists().where(UserGameRole.user_id == user.id, UserGameRole.game_id == game.id))
    )
    if not (game.owner_user_id == user.id or game.visibility == "public" or has_role):
        raise HTTPException(403, "Access denied")
    return game

# ---- PATCH ----
@router.patch("/{id}", response_model=GameOut)
async def patch_game(
    id: UUID,
    updates: dict,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    game = await db.get(Game, id)
    if not game:
        raise HTTPException(404, "Game not found")
    if game.owner_user_id != user.id :
        raise HTTPException(403, "Only owner can modify")
    for protected in ("id", "created_at", "updated_at", "owner_user_id"):
        updates.pop(protected, None)
    for k, v in updates.items():
        if hasattr(game, k):
            setattr(game, k, v)
    await db.commit()
    await db.refresh(game)
    return game

# ---- DELETE ----
@router.delete("/{id}", status_code=204)
async def delete_game(
    id: UUID,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    game = await db.get(Game, id)
    if not game:
        raise HTTPException(404, "Game not found")
    if game.owner_user_id != user.id:
        raise HTTPException(403, "Only owner can delete")
    await db.delete(game)
    await db.commit()
    return {"status": "deleted"}

