from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.conf import settings
from app.helpers import require_user, new_id
from app.helpers_cache import cache_get_json, cache_set_json, cache_get_or_set_json
from app.helpers_cache_index import cache_index_add, cache_index_invalidate
from app.schema.models import (
    Content,
    ContentActiveVersion,
    ContentCategory,
    ContentCategoryMembership,
    ContentVersion,
)
from app.schema.schemas import (
    ContentCategoryMembershipCreate,
    ContentCategoryMembershipOut,
    ContentCreate, ContentOut,
    ContentVersionCreate, ContentVersionOut,
    ContentActiveVersionUpsert, ContentActiveVersionOut
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

def idx_versions(content_id: UUID) -> str:
    return f"idx:content:versions:{content_id}"

def key_versions(content_id: UUID) -> str:
    return f"content:versions:{content_id}"

def serialize_content(row: Content) -> dict:
    return {
        "id": str(row.id),
        "pack_id": str(row.pack_id),
        "name": row.name,
        "summary": row.summary,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }

# -------- Content CRUD --------
@router.post("", response_model=ContentOut, dependencies=[Depends(require_user)])
async def create_content(
    payload: ContentCreate,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    category = await db.get(ContentCategory, payload.category_id)
    if not category or category.pack_id != payload.pack_id:
        raise HTTPException(400, "category does not belong to the requested pack")

    row = Content(
        id=new_id(),
        pack_id=payload.pack_id,
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
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
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
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
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
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    row = await db.get(Content, content_id)
    if not row:
        raise HTTPException(404, "content not found")

    for k in ("id", "pack_id", "category_id", "created_at", "updated_at"):
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
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    row = await db.get(Content, content_id)
    if row:
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
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    if payload.content_id != content_id:
        raise HTTPException(400, "content_id mismatch")

    row = ContentVersion(id=new_id(), **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_versions(content_id))
    await r.delete(key_active(content_id))  # active may be impacted by UI logic
    return row

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

    out = [
        {
            "id": str(x.id),
            "content_id": str(x.content_id),
            "version_num": x.version_num,
            "fields": x.fields,
            "created_at": x.created_at.isoformat(),
        }
        for x in rows
    ]

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
    return row

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
    return row

@router.get("/{content_id}/active", dependencies=[Depends(require_user)])
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

        return {
            "id": str(row.id),
            "content_id": str(row.content_id),
            "version_num": row.version_num,
            "fields": row.fields,
            "created_at": row.created_at.isoformat(),
        }

    return await cache_get_or_set_json(r, key_active(content_id), compute)
