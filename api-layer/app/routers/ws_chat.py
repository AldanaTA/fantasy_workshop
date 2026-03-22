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

