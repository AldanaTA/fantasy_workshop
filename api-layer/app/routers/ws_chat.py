import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.helpers import new_id, require_user_ws, json_dumps
from app.helpers_rate_limit import rate_limit_or_429
from app.schema.models import CampaignChatMessage, UserCampaignRole
from app.schema.schemas import ChatMessageIn
from app.routers.deps import CAN_READ_CAMPAIGN, CAN_WRITE_CHAT

router = APIRouter(tags=["ws"])

def public_channel(campaign_id: UUID) -> str:
    return f"campaign:{campaign_id}:chat"

def user_channel(campaign_id: UUID, user_id: UUID) -> str:
    return f"campaign:{campaign_id}:user:{user_id}:chat"

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

    q = select(UserCampaignRole.role).where(
        UserCampaignRole.campaign_id == campaign_id,
        UserCampaignRole.user_id == user_id,
    )
    role = (await db.execute(q)).scalar_one_or_none()
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

            # WS send rate limit per user per campaign
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

            payload = {
                "id": str(row.id),
                "campaign_id": str(campaign_id),
                "user_id": str(user_id),
                "message": msg_in.message,
                "whisper_to": [str(x) for x in (msg_in.whisper_to or [])],
            }
            payload_s = json_dumps(payload)

            # True whisper privacy: publish only to sender+recipients channels
            if msg_in.whisper_to:
                await r.publish(uchan, payload_s)
                for rid in msg_in.whisper_to:
                    await r.publish(user_channel(campaign_id, rid), payload_s)
            else:
                await r.publish(pub, payload_s)

    async def fanout_loop():
        while True:
            m = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if m and m.get("data"):
                await websocket.send_text(m["data"])
            await asyncio.sleep(0.01)

    try:
        await asyncio.gather(recv_loop(), fanout_loop())
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(pub, uchan)
        await pubsub.close()