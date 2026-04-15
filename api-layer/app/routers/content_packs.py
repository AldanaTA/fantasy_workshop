from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists
from uuid import UUID

from app.routers._crud import crud_router
from app.schema.db import get_db
from app.schema.models import ContentPack, Game, UserGameRole
from app.schema.schemas import ContentPackCreate, ContentPackOut
from app.helpers import require_user

router = crud_router(
    name="content_packs",
    model=ContentPack,
    create_schema=ContentPackCreate,
    out_schema=ContentPackOut,
    prefix="/content/packs",
    require_auth=True)

@router.get("/by-game/{game_id}", response_model=list[ContentPackOut], dependencies=[Depends(require_user)])
async def list_packs_by_game(
    game_id: UUID,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    has_editor_role = await db.scalar(
        select(exists().where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game_id,
            UserGameRole.role == "editor",
        ))
    )
    if not (game.owner_user_id == user_id or has_editor_role):
        raise HTTPException(403, "Access denied")

    result = await db.execute(
        select(ContentPack).where(ContentPack.game_id == game_id).order_by(ContentPack.updated_at.desc())
    )
    return list(result.scalars().all())