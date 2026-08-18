from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from uuid import UUID

from app.schema.db import get_db
from app.helpers import new_id, require_user
from app.routers.deps import require_campaign_role

from app.schema.models import (
    Campaign, UserCampaignRole, Character, CampaignCharacter,
    CampaignContentVersion,
)
from app.schema.schemas import (
    CampaignCreate, CampaignOut,
    UserCampaignRoleUpsert, UserCampaignRoleOut,
    CharacterCreate, CharacterOut,
    CampaignCharacterCreate, CampaignCharacterOut,
    CampaignContentVersionUpsert, CampaignContentVersionOut,
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
