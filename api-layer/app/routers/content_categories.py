from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists
from uuid import UUID

from app.routers._crud import crud_router
from app.schema.db import get_db
from app.schema.models import ContentCategory, ContentPack, Game, UserGameRole
from app.schema.schemas import ContentCategoryCreate, ContentCategoryOut
from app.helpers import require_user

router = crud_router(
    name="content_categories",
    model=ContentCategory,
    create_schema=ContentCategoryCreate,
    out_schema=ContentCategoryOut,
    prefix="/content/categories",
    require_auth=True)

@router.get("/by-pack/{pack_id}", response_model=list[ContentCategoryOut], dependencies=[Depends(require_user)])
async def list_categories_by_pack(
    pack_id: UUID,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "Pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    has_editor_role = await db.scalar(
        select(exists().where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game.id,
            UserGameRole.role == "editor",
        ))
    )
    if not (game.owner_user_id == user_id or has_editor_role):
        raise HTTPException(403, "Access denied")

    result = await db.execute(
        select(ContentCategory)
        .where(ContentCategory.pack_id == pack_id)
        .order_by(ContentCategory.sort_key.asc())
    )
    return list(result.scalars().all())