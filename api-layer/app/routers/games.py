from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, or_
from uuid import UUID
from redis.asyncio import Redis

from app.helpers import require_user, new_id
from app.schema.db import get_db, get_redis
from app.schema.models import ContentCategory, Game, GameRole, GameVisibility, UserGameRole, ContentPack
from app.schema.schemas import GameCreate, GameOut, LibraryGameOut
from app.helpers_rate_limit import rate_limit_or_429

router = APIRouter(prefix="/games", tags=["games"])

def _user_id(user: dict) -> UUID:
    return UUID(user["uid"])

def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)

# ---- CREATE ----
@router.post("", response_model=GameOut)
async def create_game(
    game: GameCreate,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    obj = Game(**game.model_dump(), owner_user_id=user['uid'])
    obj.id = new_id()
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    pack = ContentPack(
        id=new_id(),
        game_id=obj.id,
        owner_id=obj.owner_user_id,
        pack_name="Main Pack",
        visibility="private",
        status="draft"
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)
    category = ContentCategory(
        id=new_id(),
        pack_id=pack.id,
        name="Uncategorized"
    )
    db.add(category)
    await db.commit()
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
    user_id = _user_id(user)
    await rate_limit_or_429(redis, f"rl:games:list_owned:{user_id}", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game).where(Game.owner_user_id == user_id).limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())

# -- library listing: owned or granted through user_game_roles ---
@router.get("/library", response_model=list[LibraryGameOut])
async def list_library_games(
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    user_id = _user_id(user)
    await rate_limit_or_429(redis, f"rl:games:list_library:{user_id}", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game, UserGameRole.role).outerjoin(
        UserGameRole,
        (UserGameRole.game_id == Game.id) & (UserGameRole.user_id == user_id),
    ).where(
        or_(
            Game.owner_user_id == user_id,
            UserGameRole.user_id == user_id,
        )
    ).limit(limit).offset(offset)
    res = await db.execute(q)
    games = []
    for game, role in res.all():
        role_value = "owner" if game.owner_user_id == user_id else _enum_value(role)
        games.append(
            LibraryGameOut(
                id=game.id,
                owner_user_id=game.owner_user_id,
                game_name=game.game_name,
                game_summary=game.game_summary,
                visibility=_enum_value(game.visibility),
                role=role_value,
            )
        )
    return games

# -- editable / owned game listing ---
@router.get("/editable", response_model=list[GameOut])
async def list_editable_games(
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    user_id = _user_id(user)
    await rate_limit_or_429(redis, f"rl:games:list_editable:{user_id}", rate_per_sec=5/60, burst=10)
    limit = min(max(limit, 1), 200)
    q = select(Game).where(
        or_(
            Game.owner_user_id == user_id,
            exists().where(
                UserGameRole.user_id == user_id,
                UserGameRole.game_id == Game.id,
                UserGameRole.role == GameRole.editor,
            ),
        )
    ).limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())

# -- purchased game listing ---
@router.get("/{id}", response_model=GameOut)
async def get_game(
    id: UUID,
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
):
    user_id = _user_id(user)
    await rate_limit_or_429(redis, f"rl:games:get:{user_id}", rate_per_sec=10/60, burst=20)
    game = await db.get(Game, id)
    if not game:
        raise HTTPException(404, "Game not found")
    has_role = await db.scalar(
        select(exists().where(UserGameRole.user_id == user_id, UserGameRole.game_id == game.id))
    )
    if not (game.owner_user_id == user_id or game.visibility == GameVisibility.public or has_role):
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
    if game.owner_user_id != UUID(user["uid"]):
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
    if game.owner_user_id != UUID(user["uid"]):
        raise HTTPException(403, "Only owner can delete")
    await db.delete(game)
    await db.commit()
    return {"status": "deleted"}
