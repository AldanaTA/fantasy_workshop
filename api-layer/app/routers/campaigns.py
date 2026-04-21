from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from uuid import UUID
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.conf import settings
from app.helpers import new_id, require_user
from app.helpers_cache import cache_get_json, cache_set_json
from app.helpers_cache_index import cache_index_add, cache_index_invalidate
from app.routers.deps import (
    require_campaign_role,
    CAN_MANAGE_CAMPAIGN,
    CAN_WRITE_EVENTS,
    CAN_WRITE_SNAPSHOTS,
    CAN_READ_CAMPAIGN,
    ROLE_OWNER,
)

from app.schema.models import (
    Campaign, UserCampaignRole, Character, CampaignCharacter,
    CampaignContentVersion, CampaignEvent,
    CampaignCharacterStateSnapshot, CampaignCharacterLatestSnapshot,
)
from app.schema.schemas import (
    CampaignCreate, CampaignOut,
    UserCampaignRoleUpsert, UserCampaignRoleOut,
    CharacterCreate, CharacterOut,
    CampaignCharacterCreate, CampaignCharacterOut,
    CampaignContentVersionUpsert, CampaignContentVersionOut,
    CampaignEventCreate, CampaignEventOut,
    CampaignCharacterStateSnapshotCreate, CampaignCharacterStateSnapshotOut,
    CampaignCharacterLatestSnapshotCreate, CampaignCharacterLatestSnapshotOut,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

async def require_gm_or_co_gm(campaign_id: UUID, auth: dict = Depends(require_user), db: AsyncSession = Depends(get_db)):
    camp = await db.get(Campaign, campaign_id)
    if not camp:
        raise HTTPException(404, "campaign not found")
    user_id = UUID(auth["uid"])
    if camp.owner_user_id == user_id:
        return
    q = select(UserCampaignRole.role).where(
        UserCampaignRole.campaign_id == campaign_id,
        UserCampaignRole.user_id == user_id,
    )
    role = (await db.execute(q)).scalar_one_or_none()
    role_value = getattr(role, "value", str(role)) if role is not None else None
    if role_value != "co_gm":
        raise HTTPException(403, "you are not an owner or co-gm")

# cache keys/indexes for events
def idx_events(campaign_id: UUID) -> str:
    return f"idx:campaign:events:{campaign_id}"

def key_events(campaign_id: UUID, limit: int, offset: int) -> str:
    return f"campaign:events:{campaign_id}:l={limit}:o={offset}"

# ---- Campaigns ----
@router.post("", response_model=CampaignOut, dependencies=[Depends(require_user)])
async def create_campaign(
    payload: CampaignCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    data["owner_user_id"] = UUID(user["uid"])
    row = Campaign(id=new_id(), **data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

# -- game master campaings --
@router.get("/gm", response_model=list[CampaignOut], dependencies=[Depends(require_user)])
async def list_gm_campaigns(db: AsyncSession = Depends(get_db), user=Depends(require_user)):
    user_id = UUID(user["uid"])
    q = select(Campaign).where(
        or_(
            Campaign.owner_user_id == user_id,
            Campaign.id.in_(
                select(UserCampaignRole.campaign_id).where(
                    UserCampaignRole.user_id == user_id,
                    UserCampaignRole.role == "co_gm"
                )
            )
        )
    )
    res = await db.execute(q)
    return list(res.scalars().all())

# -- get player campaigns --
@router.get("/player", response_model=list[CampaignOut], dependencies=[Depends(require_user)])
async def list_player_campaigns(db: AsyncSession = Depends(get_db), user=Depends(require_user)):
    user_id = UUID(user["uid"])
    q = select(Campaign).join(UserCampaignRole).where(UserCampaignRole.user_id == user_id, UserCampaignRole.role == "player")
    res = await db.execute(q)
    return list(res.scalars().all())

@router.get("/{campaign_id}", response_model=CampaignOut, dependencies=[Depends(require_user)])
async def get_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(Campaign, campaign_id)
    if not row:
        raise HTTPException(404, "campaign not found")
    return row

@router.patch("/{campaign_id}", response_model=CampaignOut, dependencies=[Depends(require_user), Depends(require_gm_or_co_gm)])
async def patch_campaign(campaign_id: UUID, patch: dict, db: AsyncSession = Depends(get_db)):
    row = await db.get(Campaign, campaign_id)
    if not row:
        raise HTTPException(404, "campaign not found")
    for k in ("id", "created_at", "updated_at"):
        patch.pop(k, None)
    for k, v in patch.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{campaign_id}", status_code=204, dependencies=[Depends(require_user)])
async def delete_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(Campaign, campaign_id)
    if row:
        await db.delete(row)
        await db.commit()

# ---- Roles (composite PK upsert) ----
@router.put("/{campaign_id}/roles/{user_id}", response_model=UserCampaignRoleOut, dependencies=[Depends(require_user)])
async def upsert_role(campaign_id: UUID, user_id: UUID, payload: UserCampaignRoleUpsert, db: AsyncSession = Depends(get_db)):
    if payload.campaign_id != campaign_id or payload.user_id != user_id:
        raise HTTPException(400, "path/body mismatch")

    q = select(UserCampaignRole).where(UserCampaignRole.campaign_id == campaign_id, UserCampaignRole.user_id == user_id)
    existing = (await db.execute(q)).scalars().first()
    if existing:
        existing.role = payload.role
        await db.commit()
        return existing

    row = UserCampaignRole(**payload.model_dump())
    db.add(row)
    await db.commit()
    return row

@router.get("/{campaign_id}/roles", response_model=list[UserCampaignRoleOut], dependencies=[Depends(require_user)])
async def list_roles(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserCampaignRole).where(UserCampaignRole.campaign_id == campaign_id))
    return list(res.scalars().all())

@router.delete("/{campaign_id}/roles/{user_id}", status_code=204, dependencies=[Depends(require_user)])
async def delete_role(campaign_id: UUID, user_id: UUID, db: AsyncSession = Depends(get_db)):
    q = select(UserCampaignRole).where(UserCampaignRole.campaign_id == campaign_id, UserCampaignRole.user_id == user_id)
    row = (await db.execute(q)).scalars().first()
    if row:
        await db.delete(row)
        await db.commit()

# ---- Characters ----
@router.post("/characters", response_model=CharacterOut, dependencies=[Depends(require_user)])
async def create_character(
    payload: CharacterCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    data["user_id"] = UUID(user["uid"])
    row = Character(id=new_id(), **data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/characters/{character_id}", response_model=CharacterOut, dependencies=[Depends(require_user)])
async def get_character(character_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(Character, character_id)
    if not row:
        raise HTTPException(404, "character not found")
    return row

# ---- Campaign characters ----
@router.post("/{campaign_id}/characters", response_model=CampaignCharacterOut, dependencies=[Depends(require_user)])
async def add_campaign_character(campaign_id: UUID, payload: CampaignCharacterCreate, db: AsyncSession = Depends(get_db)):
    if payload.campaign_id != campaign_id:
        raise HTTPException(400, "campaign_id mismatch")
    row = CampaignCharacter(id=new_id(), **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/{campaign_id}/characters", response_model=list[CampaignCharacterOut], dependencies=[Depends(require_user)])
async def list_campaign_characters(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CampaignCharacter).where(CampaignCharacter.campaign_id == campaign_id))
    return list(res.scalars().all())

@router.delete("/{campaign_id}/characters/{campaign_character_id}", status_code=204, dependencies=[Depends(require_user)])
async def remove_campaign_character(campaign_id: UUID, campaign_character_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(CampaignCharacter, campaign_character_id)
    if row and row.campaign_id == campaign_id:
        await db.delete(row)
        await db.commit()

# ---- Content pins ----
@router.put("/{campaign_id}/pins/{content_id}", response_model=CampaignContentVersionOut, dependencies=[Depends(require_user)])
async def upsert_pin(campaign_id: UUID, content_id: UUID, payload: CampaignContentVersionUpsert, db: AsyncSession = Depends(get_db)):
    if payload.campaign_id != campaign_id or payload.content_id != content_id:
        raise HTTPException(400, "path/body mismatch")

    q = select(CampaignContentVersion).where(
        CampaignContentVersion.campaign_id == campaign_id,
        CampaignContentVersion.content_id == content_id,
    )
    existing = (await db.execute(q)).scalars().first()
    if existing:
        existing.pinned_version_num = payload.pinned_version_num
        await db.commit()
        await db.refresh(existing)
        return existing

    row = CampaignContentVersion(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/{campaign_id}/pins", response_model=list[CampaignContentVersionOut], dependencies=[Depends(require_user)])
async def list_pins(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CampaignContentVersion).where(CampaignContentVersion.campaign_id == campaign_id))
    return list(res.scalars().all())

@router.delete("/{campaign_id}/pins/{content_id}", status_code=204, dependencies=[Depends(require_user)])
async def delete_pin(campaign_id: UUID, content_id: UUID, db: AsyncSession = Depends(get_db)):
    q = select(CampaignContentVersion).where(
        CampaignContentVersion.campaign_id == campaign_id,
        CampaignContentVersion.content_id == content_id,
    )
    row = (await db.execute(q)).scalars().first()
    if row:
        await db.delete(row)
        await db.commit()

# ---- Events (RBAC + idempotent + cached list) ----
@router.post(
    "/{campaign_id}/events",
    response_model=CampaignEventOut,
    dependencies=[Depends(require_campaign_role(CAN_WRITE_EVENTS))]
)
async def append_event(
    campaign_id: UUID,
    payload: CampaignEventCreate,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    if payload.campaign_id != campaign_id:
        raise HTTPException(400, "campaign_id mismatch")

    q = select(CampaignEvent).where(
        CampaignEvent.campaign_id == campaign_id,
        CampaignEvent.idempotency_key == payload.idempotency_key,
    )
    existing = (await db.execute(q)).scalars().first()
    if existing:
        return existing

    row = CampaignEvent(id=new_id(), **payload.model_dump())
    db.add(row)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        existing = (await db.execute(q)).scalars().first()
        if existing:
            return existing
        raise
    await db.refresh(row)

    # invalidate cached event pages
    await cache_index_invalidate(r, idx_events(campaign_id))
    return row

@router.get(
    "/{campaign_id}/events",
    response_model=list[CampaignEventOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))]
)
async def list_events(
    campaign_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    k = key_events(campaign_id, limit, offset)
    idx = idx_events(campaign_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    res = await db.execute(
        select(CampaignEvent)
        .where(CampaignEvent.campaign_id == campaign_id)
        .order_by(CampaignEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(res.scalars().all())

    out = [
        {
            "id": str(x.id),
            "campaign_id": str(x.campaign_id),
            "character_id": str(x.character_id) if x.character_id else None,
            "user_id": str(x.user_id) if x.user_id else None,
            "payload": x.payload,
            "content_version_map": x.content_version_map,
            "event_type": x.event_type,
            "idempotency_key": x.idempotency_key,
            "created_at": x.created_at.isoformat(),
        }
        for x in rows
    ]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out

# ---- Snapshots (RBAC) ----
@router.post(
    "/{campaign_id}/snapshots",
    response_model=CampaignCharacterStateSnapshotOut,
    dependencies=[Depends(require_campaign_role(CAN_WRITE_SNAPSHOTS))]
)
async def create_snapshot(
    campaign_id: UUID,
    payload: CampaignCharacterStateSnapshotCreate,
    db: AsyncSession = Depends(get_db),
):
    if payload.campaign_id != campaign_id:
        raise HTTPException(400, "campaign_id mismatch")

    row = CampaignCharacterStateSnapshot(id=new_id(), **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get(
    "/{campaign_id}/snapshots/{snapshot_id}",
    response_model=CampaignCharacterStateSnapshotOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))]
)
async def get_snapshot(campaign_id: UUID, snapshot_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(CampaignCharacterStateSnapshot, snapshot_id)
    if not row or row.campaign_id != campaign_id:
        raise HTTPException(404, "snapshot not found")
    return row

@router.put(
    "/{campaign_id}/latest-snapshots/{id}",
    response_model=CampaignCharacterLatestSnapshotOut,
    dependencies=[Depends(require_campaign_role(CAN_WRITE_SNAPSHOTS))]
)
async def upsert_latest_snapshot(
    campaign_id: UUID,
    id: UUID,
    payload: CampaignCharacterLatestSnapshotCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.get(CampaignCharacterLatestSnapshot, id)
    if existing:
        existing.character_id = payload.character_id
        existing.latest_snapshot_id = payload.latest_snapshot_id
        await db.commit()
        await db.refresh(existing)
        return existing

    row = CampaignCharacterLatestSnapshot(id=new_id(), **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
