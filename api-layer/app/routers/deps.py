from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.helpers import require_user
from app.schema.db import get_db
from app.schema.models import UserCampaignRole, Campaign

ROLE_OWNER = "owner"
ROLE_GM = "gm"
ROLE_PLAYER = "player"
ROLE_VIEWER = "viewer"

CAN_READ_CAMPAIGN = {ROLE_OWNER, ROLE_GM, ROLE_PLAYER, ROLE_VIEWER}
CAN_WRITE_CHAT = {ROLE_OWNER, ROLE_GM, ROLE_PLAYER}
CAN_WRITE_EVENTS = {ROLE_OWNER, ROLE_GM}
CAN_WRITE_SNAPSHOTS = {ROLE_OWNER, ROLE_GM}

async def get_campaign_role(
    campaign_id: UUID,
    auth: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    camp = await db.get(Campaign, campaign_id)
    if not camp:
        raise HTTPException(404, "campaign not found")

    user_id = UUID(auth["uid"])
    q = select(UserCampaignRole.role).where(
        UserCampaignRole.campaign_id == campaign_id,
        UserCampaignRole.user_id == user_id,
    )
    role = (await db.execute(q)).scalar_one_or_none()
    if role is None:
        raise HTTPException(403, "not a member of this campaign")
    return role

def require_campaign_role(allowed_roles: set[str]):
    async def _dep(campaign_id: UUID, role: str = Depends(get_campaign_role)):
        if role not in allowed_roles:
            raise HTTPException(403, "insufficient campaign permissions")
        return {"campaign_id": campaign_id, "role": role}
    return _dep