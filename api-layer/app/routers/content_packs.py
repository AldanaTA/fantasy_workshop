from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.helpers import new_id, require_user
from app.schema.db import get_db
from app.schema.models import (
    ContentAuthority,
    ContentCategory,
    ContentPack,
    ContentPackPermission,
    Game,
    GameRole,
    UserGameRole,
    Campaign,
)
from app.schema.schemas import ContentPackCreate, ContentPackOut


router = APIRouter(prefix="/content/packs", tags=["content_packs"])


def _enum_value(value) -> str:
    return getattr(value, "value", str(value))


async def _game_access(
    game: Game,
    user_id: UUID,
    db: AsyncSession,
) -> tuple[str | None, bool, bool, bool]:
    role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game.id,
        )
    )
    role_value = _enum_value(role) if role is not None else None
    is_owner = game.owner_user_id == user_id
    has_explicit_access = is_owner or role_value is not None
    can_edit_game = is_owner or role_value == GameRole.editor.value
    has_game_access = has_explicit_access or _enum_value(game.visibility) == "public"
    return role_value, is_owner, can_edit_game, has_game_access


def _pack_is_player_visible(pack: ContentPack) -> bool:
    return _enum_value(pack.status) == "published" and _enum_value(pack.visibility) in {"game", "public"}


async def _require_pack_manage_access(
    db: AsyncSession,
    pack: ContentPack,
    user_id: UUID,
) -> None:
    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "game not found")

    _, _, can_edit_game, _ = await _game_access(game, user_id, db)
    if can_edit_game or pack.owner_id == user_id:
        return

    permission = await db.get(ContentPackPermission, {"pack_id": pack.id, "user_id": user_id})
    if permission and permission.can_manage_pack:
        return

    raise HTTPException(403, "access denied")


@router.post("", response_model=ContentPackOut, dependencies=[Depends(require_user)])
async def create_content_pack(
    content_pack_in: ContentPackCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"])
    game = await db.get(Game, content_pack_in.game_id)
    if not game:
        raise HTTPException(404, "game not found")

    role_value, is_owner, can_edit_game, _ = await _game_access(game, user_id, db)
    if not (can_edit_game or role_value == GameRole.purchaser.value):
        raise HTTPException(403, "only game owners, editors, and purchasers may create packs")

    source_campaign_id = None
    if content_pack_in.campaign_id is not None:
        campaign = await db.get(Campaign, content_pack_in.campaign_id)
        if not campaign:
            raise HTTPException(404, "campaign not found")
        if campaign.game_id != content_pack_in.game_id:
            raise HTTPException(400, "campaign must belong to the same game")
        source_campaign_id = campaign.id

    authority = ContentAuthority.owner_editor.value if (is_owner or can_edit_game) else ContentAuthority.purchaser.value

    content_pack = ContentPack(
        id=new_id(),
        game_id=content_pack_in.game_id,
        owner_id=user_id,
        campaign_id=content_pack_in.campaign_id,
        pack_name=content_pack_in.pack_name,
        description=content_pack_in.description,
        created_by_role=authority,
        source_campaign_id=source_campaign_id,
        visibility=content_pack_in.visibility,
        status=content_pack_in.status,
    )
    db.add(content_pack)
    await db.commit()
    await db.refresh(content_pack)

    category = ContentCategory(
        id=new_id(),
        pack_id=content_pack.id,
        name="Uncategorized",
    )
    db.add(category)
    await db.commit()
    await db.refresh(content_pack)
    return content_pack


@router.get("/by-game/{game_id}", response_model=list[ContentPackOut], dependencies=[Depends(require_user)])
async def list_packs_by_game(
    game_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    user_id = UUID(user["uid"])

    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(404, "game not found")

    _, _, can_edit_game, has_game_access = await _game_access(game, user_id, db)
    if not has_game_access:
        raise HTTPException(403, "access denied")

    result = await db.execute(
        select(ContentPack)
        .where(ContentPack.game_id == game_id)
        .order_by(ContentPack.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    packs = list(result.scalars().all())
    if can_edit_game:
        return packs
    return [pack for pack in packs if pack.owner_id == user_id or _pack_is_player_visible(pack)]


@router.get("/{pack_id}", response_model=ContentPackOut, dependencies=[Depends(require_user)])
async def get_content_pack(
    pack_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"])
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "content pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "game not found")

    _, _, can_edit_game, has_game_access = await _game_access(game, user_id, db)
    if can_edit_game or pack.owner_id == user_id:
        return pack
    if has_game_access and _pack_is_player_visible(pack):
        return pack
    raise HTTPException(403, "access denied")


@router.patch("/{pack_id}", response_model=ContentPackOut, dependencies=[Depends(require_user)])
async def patch_content_pack(
    pack_id: UUID,
    patch: dict,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"])
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "content pack not found")

    await _require_pack_manage_access(db, pack, user_id)

    if "campaign_id" in patch and patch["campaign_id"] is not None:
        campaign = await db.get(Campaign, patch["campaign_id"])
        if not campaign:
            raise HTTPException(404, "campaign not found")
        if campaign.game_id != pack.game_id:
            raise HTTPException(400, "campaign must belong to the same game")

    for protected in ("id", "owner_id", "game_id", "created_at", "updated_at", "created_by_role", "source_campaign_id"):
        patch.pop(protected, None)

    for key, value in patch.items():
        if hasattr(pack, key):
            setattr(pack, key, value)

    await db.commit()
    await db.refresh(pack)
    return pack


@router.delete("/userdel/{pack_id}", dependencies=[Depends(require_user)])
async def delete_content_pack(
    pack_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"])
    content_pack = await db.get(ContentPack, pack_id)
    if not content_pack:
        raise HTTPException(404, "content pack not found")

    amount_of_packs = await db.scalar(
        select(func.count(ContentPack.id)).where(ContentPack.game_id == content_pack.game_id)
    )
    if amount_of_packs == 1:
        raise HTTPException(400, "cannot delete the only content pack of a game")

    await _require_pack_manage_access(db, content_pack, user_id)
    await db.delete(content_pack)
    await db.commit()
    return Response(status_code=204)

