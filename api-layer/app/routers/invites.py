from fastapi import APIRouter, Depends, HTTPException

from uuid import UUID
import secrets

from datetime import datetime, timedelta, timezone
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.schema.schemas import InviteCreate, InviteAccept
from app.helpers import require_user
from app.helpers import hash_refresh_token as hash_token
from app.schema.db import get_db, get_redis
from app.helpers_rate_limit import rate_limit_or_429 as RateLimiter

router = APIRouter(prefix="/invites", tags=["invites"])

@router.post("/invites")
async def create_invite(
    data: InviteCreate,
    user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    await RateLimiter(redis, f"invite:creator:{user.id}:create:{data.target_id}",rate_per_sec=5/60, burst=10)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)

    expires_at = datetime.now(timezone.utc) +timedelta(days=7)
    await db.execute(
        """
        INSERT INTO invitations (
            inviter_user_id,
            invitee_email,
            target_type,
            target_id,
            role,
            token_hash,
            expires_at
        )
        VALUES (:inviter, :email, :type, :target, :role, :token, :expires)
        """,
        {
            "inviter": user.id,
            "email": data.email,
            "type": data.target_type,
            "target": data.target_id,
            "role": data.role,
            "token": token_hash,
            "expires": expires_at,
        },
    )

    await db.commit()

    return {
        "invite_link": f"https://fantasy_workshop.com/invite/{raw_token}"
    }

@router.post("/invites/accept")
async def accept_invite(
    data: InviteAccept,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_user),
    redis: Redis = Depends(get_redis),
):
    await RateLimiter(redis, f"invite:accept:{user.id}", rate_per_sec=5/60, burst=10)

    token_hash = hash_token(data.token)

    result = await db.execute(
        """
        SELECT * FROM invitations
        WHERE token_hash = :token
        AND status = 'pending'
        AND expires_at > now()
        """,
        {"token": token_hash},
    )

    invite = result.fetchone()
    if not invite:
        raise HTTPException(400, "Invalid or expired invite")

    if invite.target_type == "campaign":
        await db.execute(
            """
            INSERT INTO user_campaign_roles (user_id, campaign_id, role)
            VALUES (:user, :campaign, :role)
            ON CONFLICT DO NOTHING
            """,
            {
                "user": invite.invitee_user_id,
                "campaign": invite.target_id,
                "role": invite.role,
            },
        )

    elif invite.target_type == "game":
        await db.execute(
            """
            INSERT INTO user_game_roles (user_id, game_id, role)
            VALUES (:user, :game, :role)
            ON CONFLICT DO NOTHING
            """,
            {
                "user": invite.invitee_user_id,
                "game": invite.target_id,
                "role": invite.role,
            },
        )

    await db.execute(
        """
        UPDATE invitations
        SET status = 'accepted', invitee_user_id = :user
        WHERE id = :id
        """,
        {"user": data.receiver_id, "id": invite.id},
    )

    await db.commit()

    return {"status": "accepted"}

@router.get("/invites")
async def list_invites(user = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        """
        SELECT id, target_type, target_id, role, status, expires_at
        FROM invitations
        WHERE invitee_user_id = :user_id
        AND status = 'pending'
        """,
        {"user_id": user.id},
    )

    return [dict(row) for row in result.fetchall()]