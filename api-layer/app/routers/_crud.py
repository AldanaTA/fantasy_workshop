from typing import Type, TypeVar, Generic
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.helpers import new_id, require_user
from app.schema.db import get_db

# Pydantic model type
CreateSchemaType = TypeVar("CreateSchemaType")
OutSchemaType = TypeVar("OutSchemaType")

def crud_router(
    *,
    name: str,
    model,
    create_schema: Type[CreateSchemaType],
    out_schema: Type[OutSchemaType],
    prefix: str,
    require_auth: bool = True,
):
    router = APIRouter(prefix=prefix, tags=[name])
    deps = [Depends(require_user)] if require_auth else None

    # ---- CREATE ----
    @router.post("", response_model=out_schema, dependencies=deps)
    async def create(item: create_schema, db: AsyncSession = Depends(get_db)):  # type: ignore
        obj = model(**item.model_dump())

        # Auto-assign UUIDv7 if model has id field
        if hasattr(obj, "id") and getattr(obj, "id", None) is None:
            obj.id = new_id()

        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    # ---- GET ONE ----
    @router.get("/{id}", response_model=out_schema, dependencies=deps)
    async def get_one(id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await db.get(model, id)
        if not obj:
            raise HTTPException(404, f"{name} not found")
        return obj

    # ---- LIST ----
    @router.get("", response_model=list[out_schema], dependencies=deps)
    async def list_all(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
        limit = min(max(limit, 1), 200)
        q = select(model).limit(limit).offset(offset)
        res = await db.execute(q)
        return list(res.scalars().all())

    # ---- PATCH ----
    @router.patch("/{id}", response_model=out_schema, dependencies=deps)
    async def patch(id: UUID, item: dict, db: AsyncSession = Depends(get_db)):
        obj = await db.get(model, id)
        if not obj:
            raise HTTPException(404, f"{name} not found")

        # prevent dangerous field changes
        for protected in ("id", "created_at", "updated_at"):
            item.pop(protected, None)

        for k, v in item.items():
            if hasattr(obj, k):
                setattr(obj, k, v)

        await db.commit()
        await db.refresh(obj)
        return obj

    # ---- DELETE ----
    @router.delete("/{id}", status_code=204, dependencies=deps)
    async def delete(id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await db.get(model, id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return Response(status_code=204)

    return router