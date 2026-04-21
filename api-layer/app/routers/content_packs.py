from struct import pack

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.routers._crud import crud_router
from app.schema.db import get_db
from app.schema.models import ContentCategory, ContentPack, Game, UserGameRole
from app.schema.schemas import ContentPackCreate, ContentPackOut
from app.helpers import new_id, require_user


router = APIRouter(prefix="/content/packs", tags=["content_packs"])

def _enum_value(value) -> str:
    return getattr(value, "value", str(value))

async def _game_access(game: Game, user_id: UUID, db: AsyncSession) -> tuple[bool, bool]:
    role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game.id,
        )
    )
    has_explicit_access = game.owner_user_id == user_id or role is not None
    can_edit = game.owner_user_id == user_id or _enum_value(role) == "editor"
    has_game_access = has_explicit_access or _enum_value(game.visibility) == "public"
    return can_edit, has_explicit_access, has_game_access

def _pack_is_player_visible(pack: ContentPack) -> bool:
    return _enum_value(pack.status) == "published" and _enum_value(pack.visibility) in {"game", "public"}

@router.post("", response_model=ContentPackOut, dependencies=[Depends(require_user)])
async def create_content_pack(
    content_pack_in: ContentPackCreate,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    game = await db.get(Game, content_pack_in.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
        raise HTTPException(403, "Access denied")

    content_pack = ContentPack(**content_pack_in.dict())
    content_pack.id = new_id()
    db.add(content_pack)
    await db.commit()
    await db.refresh(content_pack)
    category = ContentCategory(
        id=new_id(),
        pack_id=content_pack.id,
        name="Uncategorized"
    )
    db.add(category)
    await db.commit()
    return content_pack

@router.delete("/userdel/{pack_id}", dependencies=[Depends(require_user)])
async def delete_content_pack(
    pack_id: UUID,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    content_pack = await db.get(ContentPack, pack_id)
    if not content_pack:
        raise HTTPException(404, "Content pack not found")
    amount_of_packs = await db.scalar(
        select(func.count(ContentPack.id)).where(ContentPack.game_id == content_pack.game_id)
    )
    if amount_of_packs == 1:
        raise HTTPException(400, "Cannot delete the only content pack of a game")
    game = await db.get(Game, content_pack.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
        raise HTTPException(403, "Access denied")

    await db.delete(content_pack)
    await db.commit()

@router.get("/by-game/{game_id}", response_model=list[ContentPackOut], dependencies=[Depends(require_user)])
async def list_packs_by_game(
    game_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, has_explicit_access, has_game_access = await _game_access(game, user_id, db)
    if not has_game_access:
        raise HTTPException(403, "Access denied")

    result = await db.execute(
        select(ContentPack)
        .where(ContentPack.game_id == game_id)
        .order_by(ContentPack.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    packs = list(result.scalars().all())
    if can_edit or has_explicit_access:
        return packs
    return [pack for pack in packs if _pack_is_player_visible(pack)]
