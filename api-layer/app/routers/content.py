from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select
from uuid import UUID
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.conf import settings
from app.helpers import require_user, new_id
from app.helpers_cache import cache_get_json, cache_set_json, cache_get_or_set_json
from app.helpers_cache_index import cache_index_add, cache_index_invalidate
from app.schema.models import (
    ContentAuthority,
    Content,
    ContentActiveVersion,
    ContentCategory,
    ContentCategoryMembership,
    ContentPack,
    ContentPackPermission,
    ContentVersion,
    Game,
    UserGameRole,
)
from app.schema.schemas import (
    ContentCategoryMembershipCreate,
    ContentCategoryMembershipOut,
    ContentCreate, ContentOut,
    ContentVersionCreate, ContentVersionOut,
    ContentActiveVersionUpsert, ContentActiveVersionOut,
    ContentWithActiveVersionOut,
)

router = APIRouter(prefix="/content", tags=["content"])

# -------- Cache keys / indexes --------
def key_active(content_id: UUID) -> str:
    return f"content:active:{content_id}"

def idx_pack(pack_id: UUID) -> str:
    return f"idx:content:pack:{pack_id}"

def idx_category(category_id: UUID) -> str:
    return f"idx:content:category:{category_id}"

def key_by_pack(pack_id: UUID, limit: int, offset: int) -> str:
    return f"content:by-pack:{pack_id}:l={limit}:o={offset}"

def key_by_category(category_id: UUID, limit: int, offset: int) -> str:
    return f"content:by-category:{category_id}:l={limit}:o={offset}"

def key_by_category_active(category_id: UUID, limit: int, offset: int, include_missing: bool) -> str:
    return f"content:by-category-active:{category_id}:l={limit}:o={offset}:missing={int(include_missing)}"

def idx_versions(content_id: UUID) -> str:
    return f"idx:content:versions:{content_id}"

def key_versions(content_id: UUID) -> str:
    return f"content:versions:{content_id}"

def serialize_content(row: Content) -> dict:
    return {
        "id": str(row.id),
        "pack_id": str(row.pack_id),
        "created_by_user_id": str(row.created_by_user_id),
        "source_authority": row.source_authority,
        "name": row.name,
        "summary": row.summary,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }

def serialize_content_version(row: ContentVersion) -> dict:
    return {
        "id": str(row.id),
        "content_id": str(row.content_id),
        "created_by_user_id": str(row.created_by_user_id),
        "version_num": row.version_num,
        "fields": row.fields,
        "schema_version": row.schema_version,
        "content_type": row.content_type,
        "created_at": row.created_at.isoformat(),
    }

def user_id_from_claims(user) -> UUID:
    return UUID(user["uid"]) if isinstance(user, dict) else user.id

def enum_value(value) -> str:
    return getattr(value, "value", str(value))


async def _game_role_value(game_id: UUID, user_id: UUID, db: AsyncSession) -> str | None:
    role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game_id,
        )
    )
    return enum_value(role) if role is not None else None


async def _can_manage_pack(pack: ContentPack, user_id: UUID, db: AsyncSession) -> bool:
    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "game not found")
    role_value = await _game_role_value(game.id, user_id, db)
    if game.owner_user_id == user_id or role_value == "editor" or pack.owner_id == user_id:
        return True
    permission = await db.get(ContentPackPermission, {"pack_id": pack.id, "user_id": user_id})
    return bool(permission and permission.can_manage_pack)


async def _can_create_content(pack: ContentPack, user_id: UUID, db: AsyncSession) -> bool:
    if await _can_manage_pack(pack, user_id, db):
        return True
    permission = await db.get(ContentPackPermission, {"pack_id": pack.id, "user_id": user_id})
    return bool(permission and permission.can_create_content)


async def _can_edit_content(content: Content, user_id: UUID, db: AsyncSession) -> bool:
    pack = await db.get(ContentPack, content.pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")
    if await _can_manage_pack(pack, user_id, db):
        return True
    if content.created_by_user_id == user_id:
        return True
    permission = await db.get(ContentPackPermission, {"pack_id": pack.id, "user_id": user_id})
    return bool(permission and permission.can_edit_any_content)


async def _can_delete_content(content: Content, user_id: UUID, db: AsyncSession) -> bool:
    pack = await db.get(ContentPack, content.pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")
    if await _can_manage_pack(pack, user_id, db):
        return True
    if content.created_by_user_id == user_id:
        return True
    permission = await db.get(ContentPackPermission, {"pack_id": pack.id, "user_id": user_id})
    return bool(permission and permission.can_delete_any_content)

async def require_category_view_access(category_id: UUID, user, db: AsyncSession) -> ContentCategory:
    category = await db.get(ContentCategory, category_id)
    if not category:
        raise HTTPException(404, "category not found")

    pack = await db.get(ContentPack, category.pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "game not found")

    user_id = user_id_from_claims(user)
    role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game.id,
        )
    )
    has_explicit_access = game.owner_user_id == user_id or role is not None
    can_edit = game.owner_user_id == user_id or enum_value(role) == "editor"
    has_game_access = has_explicit_access or enum_value(game.visibility) == "public"

    if can_edit or has_explicit_access:
        return category

    if has_game_access and enum_value(pack.status) == "published" and enum_value(pack.visibility) in {"game", "public"}:
        return category

    raise HTTPException(403, "Access denied")

async def require_pack_view_access(pack_id: UUID, user, db: AsyncSession) -> ContentPack:
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "game not found")

    user_id = user_id_from_claims(user)
    role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == game.id,
        )
    )
    has_explicit_access = game.owner_user_id == user_id or role is not None
    can_edit = game.owner_user_id == user_id or enum_value(role) == "editor"
    has_game_access = has_explicit_access or enum_value(game.visibility) == "public"

    if can_edit or has_explicit_access:
        return pack

    if has_game_access and enum_value(pack.status) == "published" and enum_value(pack.visibility) in {"game", "public"}:
        return pack

    raise HTTPException(403, "Access denied")

async def invalidate_content_category_indexes(r: Redis, db: AsyncSession, content_id: UUID):
    res = await db.execute(
        select(ContentCategoryMembership.category_id)
        .where(ContentCategoryMembership.content_id == content_id)
    )
    for category_id in res.scalars().all():
        await cache_index_invalidate(r, idx_category(category_id))

# -------- Content CRUD --------
@router.post("", response_model=ContentOut, dependencies=[Depends(require_user)])
async def create_content(
    payload: ContentCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    category = await db.get(ContentCategory, payload.category_id)
    if not category or category.pack_id != payload.pack_id:
        raise HTTPException(400, "category does not belong to the requested pack")
    pack = await db.get(ContentPack, payload.pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")
    user_id = user_id_from_claims(user)
    if not await _can_create_content(pack, user_id, db):
        raise HTTPException(403, "access denied")

    row = Content(
        id=new_id(),
        pack_id=payload.pack_id,
        created_by_user_id=user_id,
        source_authority=pack.created_by_role or ContentAuthority.owner_editor.value,
        name=payload.name,
        summary=payload.summary,
    )
    db.add(row)
    db.add(
        ContentCategoryMembership(
            pack_id=payload.pack_id,
            category_id=payload.category_id,
            content_id=row.id,
        )
    )
    await db.commit()
    await db.refresh(row)

    # invalidate pack and category lists for new content
    await cache_index_invalidate(r, idx_pack(row.pack_id))
    await cache_index_invalidate(r, idx_category(payload.category_id))
    return row

@router.get("", response_model=list[ContentOut], dependencies=[Depends(require_user)])
async def list_content(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    limit = min(max(limit, 1), 200)
    res = await db.execute(select(Content).limit(limit).offset(offset))
    return list(res.scalars().all())

@router.get("/by-pack/{pack_id}", dependencies=[Depends(require_user)])
async def list_content_by_pack(
    pack_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    await require_pack_view_access(pack_id, user, db)
    k = key_by_pack(pack_id, limit, offset)
    idx = idx_pack(pack_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    res = await db.execute(
        select(Content)
        .where(Content.pack_id == pack_id)
        .order_by(Content.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(res.scalars().all())

    out = [serialize_content(x) for x in rows]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out

@router.get("/by-category/{category_id}", dependencies=[Depends(require_user)])
async def list_content_by_category(
    category_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    await require_category_view_access(category_id, user, db)
    k = key_by_category(category_id, limit, offset)
    idx = idx_category(category_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    res = await db.execute(
        select(Content)
        .join(
            ContentCategoryMembership,
            ContentCategoryMembership.content_id == Content.id,
        )
        .where(ContentCategoryMembership.category_id == category_id)
        .order_by(Content.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(res.scalars().all())

    out = [serialize_content(x) for x in rows]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out

@router.get("/by-category/{category_id}/active", response_model=list[ContentWithActiveVersionOut], dependencies=[Depends(require_user)])
async def list_content_by_category_with_active(
    category_id: UUID,
    limit: int = 50,
    offset: int = 0,
    include_missing: bool = False,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    await require_category_view_access(category_id, user, db)

    k = key_by_category_active(category_id, limit, offset, include_missing)
    idx = idx_category(category_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    q = (
        select(Content, ContentVersion)
        .join(
            ContentCategoryMembership,
            ContentCategoryMembership.content_id == Content.id,
        )
        .outerjoin(
            ContentActiveVersion,
            and_(
                ContentActiveVersion.content_id == Content.id,
                ContentActiveVersion.deleted_at.is_(None),
            ),
        )
        .outerjoin(
            ContentVersion,
            and_(
                ContentVersion.content_id == Content.id,
                ContentVersion.version_num == ContentActiveVersion.active_version_num,
            ),
        )
        .where(ContentCategoryMembership.category_id == category_id)
        .order_by(Content.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if not include_missing:
        q = q.where(ContentVersion.id.is_not(None))

    rows = list((await db.execute(q)).all())

    out = [
        {
            "content": serialize_content(content),
            "active_version": serialize_content_version(active_version) if active_version else None,
            "error": None if active_version else "active version not found",
        }
        for content, active_version in rows
    ]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out

@router.post("/category-memberships", response_model=ContentCategoryMembershipOut, dependencies=[Depends(require_user)])
async def add_content_to_category(
    payload: ContentCategoryMembershipCreate,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    content = await db.get(Content, payload.content_id)
    category = await db.get(ContentCategory, payload.category_id)

    if not content:
        raise HTTPException(404, "content not found")
    if not category:
        raise HTTPException(404, "category not found")
    if content.pack_id != payload.pack_id or category.pack_id != payload.pack_id:
        raise HTTPException(400, "content and category must belong to the requested pack")

    existing = await db.get(
        ContentCategoryMembership,
        (payload.category_id, payload.content_id),
    )
    if existing:
        return existing

    row = ContentCategoryMembership(
        pack_id=payload.pack_id,
        category_id=payload.category_id,
        content_id=payload.content_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_category(payload.category_id))
    await cache_index_invalidate(r, idx_pack(payload.pack_id))
    return row

@router.delete("/category-memberships/{category_id}/{content_id}", status_code=204, dependencies=[Depends(require_user)])
async def remove_content_from_category(
    category_id: UUID,
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    row = await db.get(ContentCategoryMembership, (category_id, content_id))
    if row:
        pack_id = row.pack_id
        await db.delete(row)
        await db.commit()

        await cache_index_invalidate(r, idx_category(category_id))
        await cache_index_invalidate(r, idx_pack(pack_id))

@router.get("/{content_id}", response_model=ContentOut, dependencies=[Depends(require_user)])
async def get_content(content_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(Content, content_id)
    if not row:
        raise HTTPException(404, "content not found")
    return row

@router.patch("/{content_id}", response_model=ContentOut, dependencies=[Depends(require_user)])
async def patch_content(
    content_id: UUID,
    patch: dict,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    row = await db.get(Content, content_id)
    if not row:
        raise HTTPException(404, "content not found")
    user_id = user_id_from_claims(user)
    if not await _can_edit_content(row, user_id, db):
        raise HTTPException(403, "access denied")

    for k in ("id", "pack_id", "category_id", "created_at", "updated_at", "created_by_user_id", "source_authority"):
        patch.pop(k, None)

    old_pack = row.pack_id

    for k, v in patch.items():
        if hasattr(row, k):
            setattr(row, k, v)

    await db.commit()
    await db.refresh(row)

    # invalidate pack lists for old and new pack (if moved)
    await cache_index_invalidate(r, idx_pack(old_pack))
    if row.pack_id != old_pack:
        await cache_index_invalidate(r, idx_pack(row.pack_id))

    res = await db.execute(
        select(ContentCategoryMembership.category_id)
        .where(ContentCategoryMembership.content_id == content_id)
    )
    for category_id in res.scalars().all():
        await cache_index_invalidate(r, idx_category(category_id))

    return row

@router.delete("/{content_id}", status_code=204, dependencies=[Depends(require_user)])
async def delete_content(
    content_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    row = await db.get(Content, content_id)
    if row:
        user_id = user_id_from_claims(user)
        if not await _can_delete_content(row, user_id, db):
            raise HTTPException(403, "access denied")
        pack_id = row.pack_id
        res = await db.execute(
            select(ContentCategoryMembership.category_id)
            .where(ContentCategoryMembership.content_id == content_id)
        )
        category_ids = list(res.scalars().all())

        await db.delete(row)
        await db.commit()

        await cache_index_invalidate(r, idx_pack(pack_id))
        for category_id in category_ids:
            await cache_index_invalidate(r, idx_category(category_id))
        await cache_index_invalidate(r, idx_versions(content_id))
        await r.delete(key_active(content_id))

# -------- Versions --------
@router.post("/{content_id}/versions", response_model=ContentVersionOut, dependencies=[Depends(require_user)])
async def create_version(
    content_id: UUID,
    payload: ContentVersionCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    if payload.content_id is not None and payload.content_id != content_id:
        raise HTTPException(400, "content_id mismatch")

    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(404, "content not found")
    user_id = user_id_from_claims(user)
    if not await _can_edit_content(content, user_id, db):
        raise HTTPException(403, "access denied")

    version_num = payload.version_num
    if version_num is None:
        res = await db.execute(
            select(func.coalesce(func.max(ContentVersion.version_num), 0) + 1)
            .where(ContentVersion.content_id == content_id)
        )
        version_num = res.scalar_one()

    row = ContentVersion(
        id=new_id(),
        content_id=content_id,
        created_by_user_id=user_id,
        version_num=version_num,
        fields=payload.fields,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_versions(content_id))
    await r.delete(key_active(content_id))  # active may be impacted by UI logic
    await invalidate_content_category_indexes(r, db, content_id)
    return serialize_content_version(row)

@router.get("/{content_id}/versions", response_model=list[ContentVersionOut], dependencies=[Depends(require_user)])
async def list_versions(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    k = key_versions(content_id)
    idx = idx_versions(content_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    res = await db.execute(
        select(ContentVersion)
        .where(ContentVersion.content_id == content_id)
        .order_by(ContentVersion.version_num.asc())
    )
    rows = list(res.scalars().all())

    out = [serialize_content_version(x) for x in rows]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out

@router.get("/{content_id}/versions/{version_num}", response_model=ContentVersionOut, dependencies=[Depends(require_user)])
async def get_version(content_id: UUID, version_num: int, db: AsyncSession = Depends(get_db)):
    q = select(ContentVersion).where(
        ContentVersion.content_id == content_id,
        ContentVersion.version_num == version_num
    )
    row = (await db.execute(q)).scalars().first()
    if not row:
        raise HTTPException(404, "version not found")
    return serialize_content_version(row)

# -------- Active pointer --------
@router.put("/{content_id}/active", response_model=ContentActiveVersionOut, dependencies=[Depends(require_user)])
async def upsert_active(
    content_id: UUID,
    payload: ContentActiveVersionUpsert,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    if payload.content_id != content_id:
        raise HTTPException(400, "content_id mismatch")

    existing = await db.get(ContentActiveVersion, content_id)
    if existing:
        existing.active_version_num = payload.active_version_num
        existing.deleted_at = payload.deleted_at
        await db.commit()
        await db.refresh(existing)
        await r.delete(key_active(content_id))
        await invalidate_content_category_indexes(r, db, content_id)
        return existing

    row = ContentActiveVersion(
        content_id=content_id,
        active_version_num=payload.active_version_num,
        deleted_at=payload.deleted_at
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    await r.delete(key_active(content_id))
    await invalidate_content_category_indexes(r, db, content_id)
    return row

@router.get("/{content_id}/active", response_model=ContentVersionOut, dependencies=[Depends(require_user)])
async def get_active_version(
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    async def compute():
        active = await db.get(ContentActiveVersion, content_id)
        if not active or active.deleted_at is not None:
            raise HTTPException(404, "active version not found")

        q = select(ContentVersion).where(
            ContentVersion.content_id == content_id,
            ContentVersion.version_num == active.active_version_num,
        )
        row = (await db.execute(q)).scalars().first()
        if not row:
            raise HTTPException(404, "active version row missing")

        return serialize_content_version(row)

    return await cache_get_or_set_json(r, key_active(content_id), compute)
