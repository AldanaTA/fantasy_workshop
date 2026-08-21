from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.helpers import new_id, require_user
from app.schema.db import get_db
from app.schema.models import (
    Content,
    ContentCategory,
    ContentCategoryActiveSchema,
    ContentCategoryKind,
    ContentCategorySchema,
    ContentPack,
    Game,
    UserGameRole,
)
from app.schema.schemas import (
    ContentCategoryCreate,
    ContentCategoryOrderUpdate,
    ContentCategoryOut,
    ContentCategorySchemaOut,
    ContentCategorySchemaUpdate,
)

router = APIRouter(prefix="/content/categories", tags=["content_categories"])

SUPPORTED_FIELD_TYPES = {
    "string",
    "text",
    "number",
    "boolean",
    "dice",
    "formula",
    "content_reference",
    "content_reference_list",
    "object_list",
}


def _enum_value(value) -> str:
    return getattr(value, "value", str(value))


async def _game_access(game: Game, user_id: UUID, db: AsyncSession) -> tuple[bool, bool, bool]:
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


def _normalize_kind(value: str) -> str:
    if value not in {"generic", "character_sheet"}:
        raise HTTPException(400, "category kind must be 'generic' or 'character_sheet'")
    return value


def _collect_reference_fields(schema_definition: dict, path: str = "$") -> list[tuple[str, dict]]:
    refs: list[tuple[str, dict]] = []
    fields = schema_definition.get("fields")
    if isinstance(fields, list):
        for index, field in enumerate(fields):
            if not isinstance(field, dict):
                continue
            field_type = field.get("type")
            field_path = f"{path}.fields[{index}]"
            if field_type in {"content_reference", "content_reference_list"}:
                refs.append((field_path, field))
            if field_type == "object_list" and isinstance(field.get("object_schema"), dict):
                refs.extend(_collect_reference_fields(field["object_schema"], f"{field_path}.object_schema"))
    return refs


def _validate_schema_definition(kind: str, schema_definition: dict) -> dict:
    if not isinstance(schema_definition, dict):
        raise HTTPException(400, "schema_definition must be an object")

    fields = schema_definition.get("fields")
    if not isinstance(fields, list):
        raise HTTPException(400, "schema_definition.fields must be an array")

    seen_keys: set[str] = set()
    for index, field in enumerate(fields, start=1):
        if not isinstance(field, dict):
            raise HTTPException(400, f"schema_definition.fields[{index}] must be an object")

        key = field.get("key")
        field_type = field.get("type")
        if not isinstance(key, str) or not key.strip():
            raise HTTPException(400, f"schema_definition.fields[{index}].key is required")
        if key.strip() != key:
            raise HTTPException(400, f"schema_definition.fields[{index}].key must not contain outer whitespace")
        if key in seen_keys:
            raise HTTPException(400, f"schema_definition contains duplicate field key '{key}'")
        seen_keys.add(key)

        if not isinstance(field_type, str) or not field_type.strip():
            raise HTTPException(400, f"schema_definition.fields[{index}].type is required")
        if field_type not in SUPPORTED_FIELD_TYPES:
            raise HTTPException(400, f"schema_definition.fields[{index}].type '{field_type}' is not supported")

        if field_type == "object_list":
            object_schema = field.get("object_schema")
            if not isinstance(object_schema, dict):
                raise HTTPException(400, f"schema_definition.fields[{index}].object_schema is required for object_list")
            _validate_schema_definition(kind, object_schema)

    if "name" not in seen_keys:
        raise HTTPException(400, "schema_definition must include the default 'name' field")

    for field_path, field in _collect_reference_fields(schema_definition):
        allowed_categories = field.get("allowed_categories")
        if kind == "generic":
            if allowed_categories not in (None, []):
                raise HTTPException(400, f"{field_path}.allowed_categories is only valid for character_sheet categories")
        else:
            if not isinstance(allowed_categories, list) or not allowed_categories or not all(isinstance(item, str) and item.strip() for item in allowed_categories):
                raise HTTPException(400, f"{field_path}.allowed_categories is required for character_sheet references")

    return schema_definition


async def _load_category_out(db: AsyncSession, category: ContentCategory) -> ContentCategoryOut:
    active = await db.get(ContentCategoryActiveSchema, category.id)
    schema_definition = None
    active_version = None
    if active:
        active_version = active.schema_version
        schema_row = await db.get(ContentCategorySchema, (category.id, active.schema_version))
        schema_definition = schema_row.schema_definition if schema_row else None

    return ContentCategoryOut(
        id=category.id,
        pack_id=category.pack_id,
        kind=_enum_value(category.kind),
        name=category.name,
        sort_key=category.sort_key,
        active_schema_version=active_version,
        active_schema_definition=schema_definition,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


@router.post("", response_model=ContentCategoryOut, dependencies=[Depends(require_user)])
async def create_content_category(
    payload: ContentCategoryCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    pack = await db.get(ContentPack, payload.pack_id)
    if not pack:
        raise HTTPException(404, "Pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
        raise HTTPException(403, "Only the owner or editors can create content categories")

    kind = _normalize_kind(payload.kind)
    schema_definition = (
        _validate_schema_definition(kind, payload.schema_definition)
        if payload.schema_definition is not None
        else None
    )

    category = ContentCategory(
        id=new_id(),
        pack_id=payload.pack_id,
        kind=ContentCategoryKind(kind),
        name=payload.name,
        sort_key=payload.sort_key,
    )
    db.add(category)
    await db.flush()

    if schema_definition is not None:
        schema_row = ContentCategorySchema(
            category_id=category.id,
            schema_version=1,
            schema_definition=schema_definition,
            created_by_user_id=user_id,
        )
        db.add(schema_row)
        await db.flush()
        db.add(
            ContentCategoryActiveSchema(
                category_id=category.id,
                schema_version=1,
            )
        )

    await db.commit()
    await db.refresh(category)
    return await _load_category_out(db, category)


@router.get("/{id}", response_model=ContentCategoryOut, dependencies=[Depends(require_user)])
async def get_content_category(id: UUID, db: AsyncSession = Depends(get_db)):
    category = await db.get(ContentCategory, id)
    if not category:
        raise HTTPException(404, "content_categories not found")
    return await _load_category_out(db, category)


@router.patch("/{id}", response_model=ContentCategoryOut, dependencies=[Depends(require_user)])
async def patch_content_category(
    id: UUID,
    patch: dict,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    category = await db.get(ContentCategory, id)
    if not category:
        raise HTTPException(404, "content_categories not found")

    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    pack = await db.get(ContentPack, category.pack_id)
    if not pack:
        raise HTTPException(404, "Pack not found")
    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
        raise HTTPException(403, "Only the owner or editors can edit content categories")

    schema_definition = patch.pop("schema_definition", None)
    next_kind = patch.get("kind", _enum_value(category.kind))
    if "kind" in patch:
        next_kind = _normalize_kind(str(next_kind))
        category.kind = ContentCategoryKind(next_kind)

    if "name" in patch and isinstance(patch["name"], str) and patch["name"].strip():
        category.name = patch["name"].strip()

    if schema_definition is not None:
        normalized_schema = _validate_schema_definition(next_kind, schema_definition)
        next_version = (
            await db.scalar(
                select(func.coalesce(func.max(ContentCategorySchema.schema_version), 0) + 1)
                .where(ContentCategorySchema.category_id == category.id)
            )
        ) or 1
        db.add(
            ContentCategorySchema(
                category_id=category.id,
                schema_version=next_version,
                schema_definition=normalized_schema,
                created_by_user_id=user_id,
            )
        )
        await db.flush()
        active = await db.get(ContentCategoryActiveSchema, category.id)
        if active:
            active.schema_version = next_version
        else:
            db.add(ContentCategoryActiveSchema(category_id=category.id, schema_version=next_version))

    await db.commit()
    await db.refresh(category)
    return await _load_category_out(db, category)


@router.get("/{category_id}/schemas", response_model=list[ContentCategorySchemaOut], dependencies=[Depends(require_user)])
async def list_category_schemas(category_id: UUID, db: AsyncSession = Depends(get_db)):
    rows = list(
        (
            await db.execute(
                select(ContentCategorySchema)
                .where(ContentCategorySchema.category_id == category_id)
                .order_by(ContentCategorySchema.schema_version.desc())
            )
        ).scalars().all()
    )
    return rows


@router.put("/{category_id}/schema", response_model=ContentCategoryOut, dependencies=[Depends(require_user)])
async def update_category_schema(
    category_id: UUID,
    payload: ContentCategorySchemaUpdate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    return await patch_content_category(
        category_id,
        {
            "kind": payload.kind,
            "schema_definition": payload.schema_definition,
        },
        user=user,
        db=db,
    )


@router.delete("/userdel/{category_id}", dependencies=[Depends(require_user)])
async def delete_content_category(
    category_id: UUID,
    user=Depends(require_user),
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

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
        raise HTTPException(403, "Only the owner or editors can delete content categories")

    has_content = await db.scalar(
        select(func.count(Content.id)).where(Content.category_id == category_id)
    )
    if has_content:
        raise HTTPException(400, "Cannot delete a category that still contains content")

    await db.delete(category)
    await db.commit()


@router.get("/by-pack/{pack_id}", response_model=list[ContentCategoryOut], dependencies=[Depends(require_user)])
async def list_categories_by_pack(
    pack_id: UUID,
    limit: int = 50,
    offset: int = 0,
    user=Depends(require_user),
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

    can_edit, has_explicit_access, has_game_access = await _game_access(game, user_id, db)
    if not has_game_access or (not has_explicit_access and not _pack_is_player_visible(pack)):
        raise HTTPException(403, "Access denied")

    result = await db.execute(
        select(ContentCategory)
        .where(ContentCategory.pack_id == pack_id)
        .order_by(ContentCategory.sort_key.asc())
        .limit(limit)
        .offset(offset)
    )
    categories = list(result.scalars().all())
    return [await _load_category_out(db, category) for category in categories]


@router.patch("/by-pack/{pack_id}/order", response_model=list[ContentCategoryOut], dependencies=[Depends(require_user)])
async def update_categories_order(
    pack_id: UUID,
    order: ContentCategoryOrderUpdate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"]) if isinstance(user, dict) else user.id
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "Pack not found")

    game = await db.get(Game, pack.game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    can_edit, _, _ = await _game_access(game, user_id, db)
    if not can_edit:
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
    categories = list(result.scalars().all())
    return [await _load_category_out(db, category) for category in categories]
