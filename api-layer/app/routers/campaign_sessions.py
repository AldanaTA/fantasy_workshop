from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.helpers import new_id, require_user
from app.routers.deps import CAN_MANAGE_CAMPAIGN, CAN_READ_CAMPAIGN, require_campaign_role
from app.schema.db import get_db
from app.schema.models import CampaignSession
from app.schema.schemas import CampaignSessionOut


router = APIRouter(prefix="/campaigns", tags=["campaign_sessions"])


@router.get(
    "/{campaign_id}/sessions",
    response_model=list[CampaignSessionOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def list_campaign_sessions(
    campaign_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 50)
    res = await db.execute(
        select(CampaignSession)
        .where(CampaignSession.campaign_id == campaign_id)
        .order_by(CampaignSession.started_at.desc(), CampaignSession.id.desc())
        .limit(limit)
    )
    return list(res.scalars().all())


@router.get(
    "/{campaign_id}/sessions/current",
    response_model=CampaignSessionOut | None,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def get_current_campaign_session(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CampaignSession)
        .where(
            CampaignSession.campaign_id == campaign_id,
            CampaignSession.ended_at.is_(None),
        )
        .order_by(CampaignSession.started_at.desc(), CampaignSession.id.desc())
        .limit(1)
    )
    return res.scalars().first()


@router.post(
    "/{campaign_id}/sessions",
    response_model=CampaignSessionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def start_campaign_session(
    campaign_id: UUID,
    auth: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    row = CampaignSession(
        id=new_id(),
        campaign_id=campaign_id,
        started_by_user_id=UUID(auth["uid"]),
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "campaign already has an active session")
    await db.refresh(row)
    return row


@router.post(
    "/{campaign_id}/sessions/current/end",
    response_model=CampaignSessionOut,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def end_current_campaign_session(
    campaign_id: UUID,
    auth: dict = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CampaignSession)
        .where(
            CampaignSession.campaign_id == campaign_id,
            CampaignSession.ended_at.is_(None),
        )
        .order_by(CampaignSession.started_at.desc(), CampaignSession.id.desc())
        .limit(1)
    )
    row = res.scalars().first()
    if row is None:
        raise HTTPException(404, "campaign has no active session")

    row.ended_by_user_id = UUID(auth["uid"])
    row.ended_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(row)
    return row
