from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, func
from uuid import UUID

from app.routers._crud import crud_router
from app.schema.db import get_db
from app.schema.models import ContentCategory, ContentPack, Game, UserGameRole
from app.schema.schemas import ContentCategoryCreate, ContentCategoryOrderUpdate, ContentCategoryOut
from app.helpers import require_user

router = crud_router(
    name="content_categories",
    model=ContentCategory,
    create_schema=ContentCategoryCreate,
    out_schema=ContentCategoryOut,
    prefix="/content/categories",
    require_auth=True)

@router.delete("/userdel/{category_id}", dependencies=[Depends(require_user)])
async def delete_content_category(
    category_id: UUID,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    category = await db.get(ContentCategory, category_id)
    if not category:
        raise HTTPException(404, "Content category not found")
    
    category_amount = await db.scalar(
        select(func.count(ContentCategory.id)).where(ContentCategory.pack_id == category.pack_id)
    )
    if category_amount == 1:
        raise HTTPException(400, "Cannot delete the only content category of a pack")
    
    pack = await db.get(ContentPack, category.pack_id)
    if not pack:
        raise HTTPException(404, "Content pack not found")
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
        raise HTTPException(403, "Only the owner or editors can delete content categories")

    await db.delete(category)
    await db.commit()

@router.get("/by-pack/{pack_id}", response_model=list[ContentCategoryOut], dependencies=[Depends(require_user)])
async def list_categories_by_pack(
    pack_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
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
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())

@router.patch("/by-pack/{pack_id}/order", response_model=list[ContentCategoryOut], dependencies=[Depends(require_user)])
async def update_categories_order(
    pack_id: UUID,
    order: ContentCategoryOrderUpdate,
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
        raise HTTPException(403, "Only the owner or editors can reorder content categories")

    result = await db.execute(
        select(ContentCategory).where(ContentCategory.pack_id == pack_id)
    )
    categories = list(result.scalars().all())
    category_by_id = {category.id: category for category in categories}

    submitted_ids = order.category_ids
    if len(submitted_ids) != len(set(submitted_ids)):
        raise HTTPException(400, "Category order contains duplicate IDs")

    if set(submitted_ids) != set(category_by_id):
        raise HTTPException(400, "Category order must include every category in this pack")

    temporary_base = min([category.sort_key for category in categories] + [0]) - len(categories) - 1
    for index, category in enumerate(categories):
        category.sort_key = temporary_base - index

    await db.flush()

    for index, category_id in enumerate(submitted_ids):
        category_by_id[category_id].sort_key = (index + 1) * 10

    await db.commit()

    result = await db.execute(
        select(ContentCategory)
        .where(ContentCategory.pack_id == pack_id)
        .order_by(ContentCategory.sort_key.asc())
    )
    return list(result.scalars().all())
