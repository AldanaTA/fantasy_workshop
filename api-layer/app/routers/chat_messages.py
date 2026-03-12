from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.conf import settings
from app.helpers import require_user, new_id
from app.helpers_cache import cache_get_json, cache_set_json
from app.helpers_cache_index import cache_index_add, cache_index_invalidate
from app.routers.deps import require_campaign_role, CAN_READ_CAMPAIGN, CAN_WRITE_CHAT

from app.schema.models import CampaignChatMessage
from app.schema.schemas import ChatMessageCreate, ChatMessageOut

router = APIRouter(prefix="/chat", tags=["chat"])

def idx_chat(campaign_id: UUID) -> str:
    return f"idx:chat:campaign:{campaign_id}"

def key_chat(campaign_id: UUID, limit: int, offset: int) -> str:
    return f"chat:campaign:{campaign_id}:l={limit}:o={offset}"

@router.post(
    "/messages",
    response_model=ChatMessageOut,
    dependencies=[Depends(require_user)]
)
async def create_message(
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
    perms: dict = Depends(require_campaign_role(CAN_WRITE_CHAT)),
):
    # NOTE: This HTTP endpoint is optional if you prefer WS-only writes
    row = CampaignChatMessage(id=new_id(), **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)

    await cache_index_invalidate(r, idx_chat(row.campaign_id))
    return row

@router.get(
    "/campaigns/{campaign_id}/messages",
    response_model=list[ChatMessageOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))]
)
async def list_messages(
    campaign_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    k = key_chat(campaign_id, limit, offset)
    idx = idx_chat(campaign_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    res = await db.execute(
        select(CampaignChatMessage)
        .where(CampaignChatMessage.campaign_id == campaign_id)
        .order_by(CampaignChatMessage.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(res.scalars().all())

    out = [
        {
            "id": str(x.id),
            "campaign_id": str(x.campaign_id),
            "user_id": str(x.user_id),
            "whisper_to": [str(u) for u in (x.whisper_to or [])] if x.whisper_to else None,
            "message": x.message,
            "created_at": x.created_at.isoformat(),
        }
        for x in rows
    ]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out