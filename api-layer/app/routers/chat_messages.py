import asyncio
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conf import settings
from app.helpers import json_dumps, new_id, require_user_ws
from app.helpers_cache import cache_get_json, cache_set_json
from app.helpers_cache_index import cache_index_add
from app.helpers_rate_limit import rate_limit_or_429
from app.routers.deps import CAN_READ_CAMPAIGN, CAN_WRITE_CHAT, get_campaign_role_for_user, require_campaign_role
from app.schema.db import get_db, get_redis
from app.schema.models import Campaign, CampaignChatMessage
from app.schema.schemas import ChatMessageIn, ChatMessageOut, ChatMessagePageOut


router = APIRouter(prefix="/chat", tags=["chat"])


def idx_chat(campaign_id: UUID) -> str:
    return f"idx:chat:campaign:{campaign_id}"


def key_chat(campaign_id: UUID, limit: int, offset: int) -> str:
    return f"chat:campaign:{campaign_id}:l={limit}:o={offset}"


def key_chat_page(
    campaign_id: UUID,
    limit: int,
    before_created_at: datetime | None,
    before_id: UUID | None,
) -> str:
    return f"chat:campaign:{campaign_id}:page:l={limit}:t={before_created_at}:id={before_id}"


def public_channel(campaign_id: UUID) -> str:
    return f"campaign:{campaign_id}:chat"


def user_channel(campaign_id: UUID, user_id: UUID) -> str:
    return f"campaign:{campaign_id}:user:{user_id}:chat"


async def _campaign_role_for_socket(db: AsyncSession, campaign_id: UUID, user_id: UUID) -> str | None:
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        return None
    if campaign.owner_user_id == user_id:
        return "owner"
    return await get_campaign_role_for_user(db, campaign_id, user_id)


def _serialize_message(row: CampaignChatMessage) -> dict:
    return {
        "id": str(row.id),
        "campaign_id": str(row.campaign_id),
        "user_id": str(row.user_id),
        "whisper_to": [str(user_id) for user_id in (row.whisper_to or [])] if row.whisper_to else None,
        "message": row.message,
        "created_at": row.created_at.isoformat(),
    }


@router.websocket("/ws/campaigns/{campaign_id}/chat")
async def ws_campaign_chat(
    websocket: WebSocket,
    campaign_id: UUID,
    auth: dict = Depends(require_user_ws),
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    await websocket.accept()
    user_id = UUID(auth["uid"])

    role = await _campaign_role_for_socket(db, campaign_id, user_id)
    if role is None or role not in CAN_READ_CAMPAIGN:
        await websocket.close(code=1008)
        return

    can_send = role in CAN_WRITE_CHAT
    pub = public_channel(campaign_id)
    uchan = user_channel(campaign_id, user_id)

    pubsub = r.pubsub()
    await pubsub.subscribe(pub, uchan)

    async def recv_loop():
        if not can_send:
            while True:
                await websocket.receive_text()

        while True:
            data = await websocket.receive_json()
            msg_in = ChatMessageIn(**data)

            await rate_limit_or_429(
                r,
                f"rl:ws:chat:campaign:{campaign_id}:user:{user_id}",
                rate_per_sec=2.0,
                burst=10.0,
                cost=1.0,
            )

            row = CampaignChatMessage(
                id=new_id(),
                campaign_id=campaign_id,
                user_id=user_id,
                whisper_to=msg_in.whisper_to,
                message=msg_in.message,
            )
            db.add(row)
            await db.commit()
            await db.refresh(row)

            payload_s = json_dumps(_serialize_message(row))
            if msg_in.whisper_to:
                await r.publish(uchan, payload_s)
                for recipient_id in msg_in.whisper_to:
                    await r.publish(user_channel(campaign_id, recipient_id), payload_s)
            else:
                await r.publish(pub, payload_s)

    async def fanout_loop():
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("data"):
                await websocket.send_text(message["data"])
            await asyncio.sleep(0.01)

    try:
        await asyncio.gather(recv_loop(), fanout_loop())
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(pub, uchan)
        await pubsub.close()


@router.get(
    "/campaigns/{campaign_id}/messages",
    response_model=list[ChatMessageOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
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
        .order_by(CampaignChatMessage.created_at.desc(), CampaignChatMessage.id.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(res.scalars().all())
    out = [_serialize_message(row) for row in rows]

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out


@router.get(
    "/campaigns/{campaign_id}/messages/page",
    response_model=ChatMessagePageOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def list_messages_page(
    campaign_id: UUID,
    limit: int = 50,
    before_created_at: datetime | None = None,
    before_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    limit = min(max(limit, 1), 200)
    k = key_chat_page(campaign_id, limit, before_created_at, before_id)
    idx = idx_chat(campaign_id)

    cached = await cache_get_json(r, k)
    if cached is not None:
        return cached

    q = (
        select(CampaignChatMessage)
        .where(CampaignChatMessage.campaign_id == campaign_id)
        .order_by(CampaignChatMessage.created_at.desc(), CampaignChatMessage.id.desc())
        .limit(limit)
    )

    if before_created_at is not None and before_id is not None:
        q = q.where(
            or_(
                CampaignChatMessage.created_at < before_created_at,
                and_(
                    CampaignChatMessage.created_at == before_created_at,
                    CampaignChatMessage.id < before_id,
                ),
            )
        )

    rows = list((await db.execute(q)).scalars().all())
    items = [_serialize_message(row) for row in rows]
    next_before_created_at = rows[-1].created_at if rows else None
    next_before_id = rows[-1].id if rows else None
    out = {
        "items": items,
        "next_before_created_at": next_before_created_at.isoformat() if next_before_created_at else None,
        "next_before_id": str(next_before_id) if next_before_id else None,
    }

    await cache_set_json(r, k, out, ttl=settings.CACHE_DEFAULT_TTL_SECONDS)
    await cache_index_add(r, idx, k, ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS * 3)
    return out
