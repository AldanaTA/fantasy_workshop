from datetime import datetime, timedelta, timezone
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conf import settings
from app.helpers import new_id, require_user
from app.schema.db import get_db
from app.schema.models import Game, GameRole, GameShareLink, UserGameRole
from app.schema.schemas import (
    GameShareAcceptResult,
    GameShareLinkCreate,
    GameShareLinkOut,
    GameSharePreview,
)

router = APIRouter(tags=["game-share-links"])


def _user_id(user: dict) -> UUID:
    return UUID(user["uid"])


def _share_url(token: str) -> str:
    return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/game-invite/{token}"


def _role_value(role: GameRole | str) -> str:
    return role.value if isinstance(role, GameRole) else role


def _role_for_link(role: str) -> GameRole:
    try:
        return GameRole(role)
    except ValueError:
        raise HTTPException(400, "Invalid game role")


def _out(link: GameShareLink) -> GameShareLinkOut:
    return GameShareLinkOut(
        id=link.id,
        game_id=link.game_id,
        token=link.token,
        url=_share_url(link.token),
        role=_role_value(link.role),
        expires_at=link.expires_at,
        max_uses=link.max_uses,
        uses_count=link.uses_count,
        revoked_at=link.revoked_at,
        created_at=link.created_at,
    )


async def _can_edit_game(db: AsyncSession, game_id: UUID, user_id: UUID) -> Game:
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    has_editor_role = await db.scalar(
        select(
            exists().where(
                UserGameRole.user_id == user_id,
                UserGameRole.game_id == game_id,
                UserGameRole.role == GameRole.editor,
            )
        )
    )
    if not (game.owner_user_id == user_id or has_editor_role):
        raise HTTPException(403, "Only the game owner or editors can share this game")
    return game


@router.post("/games/{game_id}/share-links", response_model=GameShareLinkOut)
async def create_game_share_link(
    game_id: UUID,
    data: GameShareLinkCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = _user_id(user)
    await _can_edit_game(db, game_id, user_id)

    role = _role_for_link(data.role)
    token = secrets.token_urlsafe(32)
    link = GameShareLink(
        id=new_id(),
        game_id=game_id,
        created_by_user_id=user_id,
        token=token,
        role=role,
        max_uses=data.max_uses,
        expires_at=datetime.now(timezone.utc) + timedelta(days=data.expires_in_days),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _out(link)


@router.get("/games/{game_id}/share-links", response_model=list[GameShareLinkOut])
async def list_game_share_links(
    game_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = _user_id(user)
    await _can_edit_game(db, game_id, user_id)

    res = await db.execute(
        select(GameShareLink)
        .where(GameShareLink.game_id == game_id)
        .order_by(GameShareLink.created_at.desc())
    )
    return [_out(link) for link in res.scalars().all()]


@router.delete("/games/{game_id}/share-links/{share_link_id}", status_code=204)
async def revoke_game_share_link(
    game_id: UUID,
    share_link_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = _user_id(user)
    await _can_edit_game(db, game_id, user_id)

    link = await db.get(GameShareLink, share_link_id)
    if not link or link.game_id != game_id:
        raise HTTPException(404, "Share link not found")
    if link.revoked_at is None:
        link.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/game-share-links/{token}", response_model=GameSharePreview)
async def get_game_share_link_preview(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(GameShareLink, Game)
        .join(Game, Game.id == GameShareLink.game_id)
        .where(GameShareLink.token == token)
    )
    row = res.one_or_none()
    if not row:
        raise HTTPException(404, "Share link not found")

    link, game = row
    now = datetime.now(timezone.utc)
    is_expired = link.expires_at <= now
    is_revoked = link.revoked_at is not None
    uses_available = link.max_uses is None or link.uses_count < link.max_uses

    return GameSharePreview(
        game_id=game.id,
        game_name=game.game_name,
        game_summary=game.game_summary,
        role=_role_value(link.role),
        expires_at=link.expires_at,
        is_expired=is_expired,
        is_revoked=is_revoked,
        is_usable=not is_expired and not is_revoked and uses_available,
    )


@router.post("/game-share-links/{token}/accept", response_model=GameShareAcceptResult)
async def accept_game_share_link(
    token: str,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = _user_id(user)
    res = await db.execute(
        select(GameShareLink, Game)
        .join(Game, Game.id == GameShareLink.game_id)
        .where(GameShareLink.token == token)
        .with_for_update(of=GameShareLink)
    )
    row = res.one_or_none()
    if not row:
        raise HTTPException(404, "Share link not found")

    link, game = row
    now = datetime.now(timezone.utc)
    if link.revoked_at is not None:
        raise HTTPException(400, "Share link has been revoked")
    if link.expires_at <= now:
        raise HTTPException(400, "Share link has expired")

    existing_role = await db.scalar(
        select(UserGameRole.role).where(
            UserGameRole.user_id == user_id,
            UserGameRole.game_id == link.game_id,
        )
    )
    already_has_access = game.owner_user_id == user_id or existing_role is not None
    if not already_has_access and link.max_uses is not None and link.uses_count >= link.max_uses:
        raise HTTPException(400, "Share link has no uses remaining")

    if game.owner_user_id != user_id:
        if existing_role is None:
            db.add(UserGameRole(user_id=user_id, game_id=link.game_id, role=link.role))
            link.uses_count += 1
        elif existing_role != GameRole.editor and link.role == GameRole.editor:
            role_row = await db.get(UserGameRole, {"user_id": user_id, "game_id": link.game_id})
            if role_row:
                role_row.role = GameRole.editor

    await db.commit()
    return GameShareAcceptResult(
        game_id=link.game_id,
        role=_role_value(link.role),
        status="accepted",
    )
