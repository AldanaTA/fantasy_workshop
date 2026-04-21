from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.helpers import require_user
from app.routers.deps import CAN_MANAGE_CAMPAIGN, CAN_READ_CAMPAIGN, require_campaign_role
from app.schema.db import get_db
from app.schema.models import Campaign, CampaignAllowedPack, ContentPack
from app.schema.schemas import CampaignAllowedPackOut


router = APIRouter(prefix="/campaigns", tags=["campaign_allowed_packs"])


@router.get(
    "/{campaign_id}/allowed-packs",
    response_model=list[CampaignAllowedPackOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def list_allowed_packs(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CampaignAllowedPack)
        .where(
            CampaignAllowedPack.campaign_id == campaign_id,
            CampaignAllowedPack.revoked_at.is_(None),
        )
        .order_by(CampaignAllowedPack.created_at.desc())
    )
    return list(res.scalars().all())


@router.put(
    "/{campaign_id}/allowed-packs/{pack_id}",
    response_model=CampaignAllowedPackOut,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def allow_pack_for_campaign(
    campaign_id: UUID,
    pack_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "campaign not found")
    pack = await db.get(ContentPack, pack_id)
    if not pack:
        raise HTTPException(404, "pack not found")
    if pack.game_id != campaign.game_id:
        raise HTTPException(400, "pack must belong to the same game as the campaign")

    row = await db.get(CampaignAllowedPack, {"campaign_id": campaign_id, "pack_id": pack_id})
    if row:
        row.game_id = campaign.game_id
        row.allowed_by_user_id = UUID(user["uid"])
        row.revoked_at = None
        await db.commit()
        await db.refresh(row)
        return row

    row = CampaignAllowedPack(
        campaign_id=campaign_id,
        pack_id=pack_id,
        game_id=campaign.game_id,
        allowed_by_user_id=UUID(user["uid"]),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete(
    "/{campaign_id}/allowed-packs/{pack_id}",
    status_code=204,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def revoke_allowed_pack(
    campaign_id: UUID,
    pack_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CampaignAllowedPack, {"campaign_id": campaign_id, "pack_id": pack_id})
    if row:
        row.revoked_at = datetime.now(timezone.utc)
        await db.commit()
    return Response(status_code=204)
