from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.conf import settings
from app.helpers import new_id, require_user
from app.helpers_cache import (
    cache_get_json,
    cache_get_or_set_json,
    cache_index_add,
    cache_index_invalidate,
    cache_set_json,
)
from app.schema.db import get_db, get_redis
from app.schema.models import (
    Content,
    ContentActiveVersion,
    ContentAuthority,
    ContentCategory,
    ContentCategoryActiveSchema,
    ContentCategoryKind,
    ContentCategorySchema,
    ContentPack,
    ContentPackPermission,
    ContentVersion,
    Game,
    UserGameRole,
)
from app.schema.schemas import (
    ContentActiveVersionOut,
    ContentActiveVersionUpsert,
    ContentCreate,
    ContentOut,
    ContentVersionCreate,
    ContentVersionOut,
    ContentWithActiveVersionOut,
)

router = APIRouter(prefix="/content", tags=["content"])


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
        "category_id": str(row.category_id),
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
        "category_id": str(row.category_id),
        "category_schema_version": row.category_schema_version,
        "created_by_user_id": str(row.created_by_user_id),
        "version_num": row.version_num,
        "fields": row.fields,
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


async def _get_active_category_schema(db: AsyncSession, category_id: UUID) -> ContentCategorySchema:
    active = await db.get(ContentCategoryActiveSchema, category_id)
    if not active:
        raise HTTPException(400, "category does not have an active schema")

    schema_row = await db.get(
        ContentCategorySchema,
        (category_id, active.schema_version),
    )
    if not schema_row:
        raise HTTPException(400, "active category schema could not be found")
    return schema_row


def _find_schema_field(fields: list[dict], key: str) -> dict | None:
    for field in fields:
        if isinstance(field, dict) and field.get("key") == key:
            return field
    return None


async def _validate_schema_value(
    db: AsyncSession,
    *,
    pack_id: UUID,
    current_category: ContentCategory,
    field: dict,
    value,
    path: str,
):
    field_type = field.get("type")
    label = field.get("label") or field.get("key") or path

    if value is None:
        return

    if field_type in {"string", "text"}:
        if not isinstance(value, str):
            raise HTTPException(400, f"{label} must be a string")
        return

    if field_type == "number":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise HTTPException(400, f"{label} must be a number")
        return

    if field_type == "boolean":
        if not isinstance(value, bool):
            raise HTTPException(400, f"{label} must be a boolean")
        return

    if field_type in {"content_reference", "content_reference_list"}:
        values = [value] if field_type == "content_reference" else value
        if field_type == "content_reference_list" and not isinstance(values, list):
            raise HTTPException(400, f"{label} must be a list of content references")
        if field_type == "content_reference" and not isinstance(value, str):
            raise HTTPException(400, f"{label} must be a content id")

        allowed_categories = field.get("allowed_categories")
        for index, raw_content_id in enumerate(values if isinstance(values, list) else [values], start=1):
            if not isinstance(raw_content_id, str):
                raise HTTPException(400, f"{label}[{index}] must be a content id")
            try:
                content_id = UUID(raw_content_id)
            except ValueError as exc:
                raise HTTPException(400, f"{label}[{index}] must be a valid UUID") from exc

            ref_content = await db.get(Content, content_id)
            if not ref_content or ref_content.pack_id != pack_id:
                raise HTTPException(400, f"{label}[{index}] references content outside this pack")

            ref_category = await db.get(ContentCategory, ref_content.category_id)
            if not ref_category:
                raise HTTPException(400, f"{label}[{index}] references content with a missing category")

            if current_category.kind == ContentCategoryKind.generic:
                if ref_content.category_id != current_category.id:
                    raise HTTPException(400, f"{label}[{index}] may only reference content in the same category")
            else:
                allowed_names = allowed_categories if isinstance(allowed_categories, list) else []
                if ref_category.name not in allowed_names:
                    raise HTTPException(400, f"{label}[{index}] references a category not allowed by this character sheet schema")
        return

    if field_type == "object_list":
        if not isinstance(value, list):
            raise HTTPException(400, f"{label} must be a list")
        object_schema = field.get("object_schema")
        object_fields = object_schema.get("fields", []) if isinstance(object_schema, dict) else []
        for row_index, row in enumerate(value, start=1):
            if not isinstance(row, dict):
                raise HTTPException(400, f"{label}[{row_index}] must be an object")
            for nested_field in object_fields:
                if not isinstance(nested_field, dict):
                    continue
                nested_key = nested_field.get("key")
                if not isinstance(nested_key, str):
                    continue
                await _validate_schema_value(
                    db,
                    pack_id=pack_id,
                    current_category=current_category,
                    field=nested_field,
                    value=row.get(nested_key),
                    path=f"{path}.{nested_key}",
                )
        return


async def _validate_content_fields_against_schema(
    db: AsyncSession,
    *,
    pack_id: UUID,
    category: ContentCategory,
    schema_definition: dict,
    fields: dict,
):
    if not isinstance(fields, dict):
        raise HTTPException(400, "fields must be an object")

    schema_fields = schema_definition.get("fields")
    if not isinstance(schema_fields, list):
        raise HTTPException(400, "category schema is invalid")

    allowed_keys = {
        field.get("key")
        for field in schema_fields
        if isinstance(field, dict) and isinstance(field.get("key"), str)
    }
    extra_keys = [key for key in fields if key not in allowed_keys]
    if extra_keys:
        raise HTTPException(400, f"fields contains keys not defined by the category schema: {', '.join(sorted(extra_keys))}")

    for field in schema_fields:
        if not isinstance(field, dict):
            continue
        key = field.get("key")
        if not isinstance(key, str):
            continue
        value = fields.get(key)
        required = field.get("required", False) or key == "name"
        if required and value in (None, "", []):
            raise HTTPException(400, f"{key} is required by the category schema")
        await _validate_schema_value(
            db,
            pack_id=pack_id,
            current_category=category,
            field=field,
            value=value,
            path=f"$.{key}",
        )


async def invalidate_content_category_indexes(r: Redis, db: AsyncSession, content_id: UUID):
    row = await db.get(Content, content_id)
    if row:
        await cache_index_invalidate(r, idx_category(row.category_id))


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

    await _get_active_category_schema(db, payload.category_id)

    user_id = user_id_from_claims(user)
    if not await _can_create_content(pack, user_id, db):
        raise HTTPException(403, "access denied")

    row = Content(
        id=new_id(),
        pack_id=payload.pack_id,
        category_id=payload.category_id,
        created_by_user_id=user_id,
        source_authority=pack.created_by_role or ContentAuthority.owner_editor.value,
        name=payload.name,
        summary=payload.summary,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_pack(row.pack_id))
    await cache_index_invalidate(r, idx_category(row.category_id))
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
    user=Depends(require_user),
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

    rows = list(
        (
            await db.execute(
                select(Content)
                .where(Content.pack_id == pack_id)
                .order_by(Content.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
    )
    out = [serialize_content(x) for x in rows]
    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out


@router.get("/by-category/{category_id}", dependencies=[Depends(require_user)])
async def list_content_by_category(
    category_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user=Depends(require_user),
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

    rows = list(
        (
            await db.execute(
                select(Content)
                .where(Content.category_id == category_id)
                .order_by(Content.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
    )
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
    user=Depends(require_user),
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
        .where(Content.category_id == category_id)
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

    old_pack_id = row.pack_id
    old_category_id = row.category_id

    for key in ("id", "pack_id", "category_id", "created_at", "updated_at", "created_by_user_id", "source_authority"):
        patch.pop(key, None)

    for key, value in patch.items():
        if hasattr(row, key):
            setattr(row, key, value)

    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_pack(old_pack_id))
    await cache_index_invalidate(r, idx_category(old_category_id))
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
        category_id = row.category_id
        await db.delete(row)
        await db.commit()

        await cache_index_invalidate(r, idx_pack(pack_id))
        await cache_index_invalidate(r, idx_category(category_id))
        await cache_index_invalidate(r, idx_versions(content_id))
        await r.delete(key_active(content_id))


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

    category = await db.get(ContentCategory, content.category_id)
    if not category:
        raise HTTPException(404, "category not found")

    active_schema = await _get_active_category_schema(db, category.id)
    await _validate_content_fields_against_schema(
        db,
        pack_id=content.pack_id,
        category=category,
        schema_definition=active_schema.schema_definition,
        fields=payload.fields,
    )

    user_id = user_id_from_claims(user)
    if not await _can_edit_content(content, user_id, db):
        raise HTTPException(403, "access denied")

    version_num = payload.version_num
    if version_num is None:
        version_num = (
            await db.scalar(
                select(func.coalesce(func.max(ContentVersion.version_num), 0) + 1)
                .where(ContentVersion.content_id == content_id)
            )
        ) or 1

    row = ContentVersion(
        id=new_id(),
        content_id=content_id,
        category_id=content.category_id,
        category_schema_version=active_schema.schema_version,
        created_by_user_id=user_id,
        version_num=version_num,
        fields=payload.fields,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_versions(content_id))
    await r.delete(key_active(content_id))
    await cache_index_invalidate(r, idx_pack(content.pack_id))
    await cache_index_invalidate(r, idx_category(content.category_id))
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

    rows = list(
        (
            await db.execute(
                select(ContentVersion)
                .where(ContentVersion.content_id == content_id)
                .order_by(ContentVersion.version_num.asc())
            )
        ).scalars().all()
    )
    out = [serialize_content_version(x) for x in rows]
    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out


@router.get("/{content_id}/versions/{version_num}", response_model=ContentVersionOut, dependencies=[Depends(require_user)])
async def get_version(content_id: UUID, version_num: int, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(
            select(ContentVersion).where(
                ContentVersion.content_id == content_id,
                ContentVersion.version_num == version_num,
            )
        )
    ).scalars().first()
    if not row:
        raise HTTPException(404, "version not found")
    return serialize_content_version(row)


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
        deleted_at=payload.deleted_at,
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

        row = (
            await db.execute(
                select(ContentVersion).where(
                    ContentVersion.content_id == content_id,
                    ContentVersion.version_num == active.active_version_num,
                )
            )
        ).scalars().first()
        if not row:
            raise HTTPException(404, "active version row missing")
        return serialize_content_version(row)

    return await cache_get_or_set_json(r, key_active(content_id), compute)
