from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.helpers import new_id, require_user
from app.routers.deps import CAN_MANAGE_CAMPAIGN, CAN_READ_CAMPAIGN, get_campaign_role, require_campaign_role
from app.schema.db import get_db
from app.schema.models import CampaignNote, CampaignNoteRevision
from app.schema.schemas import (
    CampaignNoteCreate,
    CampaignNoteOut,
    CampaignNoteRevisionOut,
    CampaignNoteUpdate,
)


router = APIRouter(prefix="/campaigns", tags=["campaign_notes"])


@router.get(
    "/{campaign_id}/notes",
    response_model=list[CampaignNoteOut],
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def list_campaign_notes(
    campaign_id: UUID,
    include_archived: bool = False,
    visibility: str = "all",
    limit: int = 50,
    offset: int = 0,
    role: str = Depends(get_campaign_role),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    q = select(CampaignNote).where(CampaignNote.campaign_id == campaign_id)

    if not include_archived:
        q = q.where(CampaignNote.archived_at.is_(None))

    if role not in CAN_MANAGE_CAMPAIGN:
        q = q.where(CampaignNote.visibility == "shared")
    elif visibility in {"gm", "shared"}:
        q = q.where(CampaignNote.visibility == visibility)

    q = q.order_by(CampaignNote.updated_at.desc()).limit(limit).offset(offset)
    res = await db.execute(q)
    return list(res.scalars().all())


@router.post(
    "/{campaign_id}/notes",
    response_model=CampaignNoteOut,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def create_campaign_note(
    campaign_id: UUID,
    payload: CampaignNoteCreate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(user["uid"])
    note = CampaignNote(
        id=new_id(),
        campaign_id=campaign_id,
        title=payload.title,
        body=payload.body,
        visibility=payload.visibility,
        created_by_user_id=user_id,
        updated_by_user_id=user_id,
        version_num=1,
    )
    db.add(note)
    db.add(
        CampaignNoteRevision(
            note_id=note.id,
            version_num=1,
            title=note.title,
            body=note.body,
            visibility=note.visibility,
            updated_by_user_id=user_id,
        )
    )
    await db.commit()
    await db.refresh(note)
    return note


@router.get(
    "/{campaign_id}/notes/{note_id}",
    response_model=CampaignNoteOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def get_campaign_note(
    campaign_id: UUID,
    note_id: UUID,
    role: str = Depends(get_campaign_role),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(CampaignNote, note_id)
    if not note or note.campaign_id != campaign_id:
        raise HTTPException(404, "note not found")
    if role not in CAN_MANAGE_CAMPAIGN and note.visibility != "shared":
        raise HTTPException(403, "access denied")
    return note


@router.patch(
    "/{campaign_id}/notes/{note_id}",
    response_model=CampaignNoteOut,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def update_campaign_note(
    campaign_id: UUID,
    note_id: UUID,
    payload: CampaignNoteUpdate,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(CampaignNote, note_id)
    if not note or note.campaign_id != campaign_id:
        raise HTTPException(404, "note not found")
    if note.version_num != payload.expected_version_num:
        raise HTTPException(409, "note version conflict")

    if payload.title is not None:
        note.title = payload.title
    if payload.body is not None:
        note.body = payload.body
    if payload.visibility is not None:
        note.visibility = payload.visibility
    note.version_num += 1
    note.updated_by_user_id = UUID(user["uid"])
    note.updated_at = datetime.now(timezone.utc)

    db.add(
        CampaignNoteRevision(
            note_id=note.id,
            version_num=note.version_num,
            title=note.title,
            body=note.body,
            visibility=note.visibility,
            updated_by_user_id=note.updated_by_user_id,
        )
    )
    await db.commit()
    await db.refresh(note)
    return note


@router.delete(
    "/{campaign_id}/notes/{note_id}",
    status_code=204,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def delete_campaign_note(
    campaign_id: UUID,
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(CampaignNote, note_id)
    if not note or note.campaign_id != campaign_id:
        raise HTTPException(404, "note not found")
    note.archived_at = datetime.now(timezone.utc)
    note.updated_at = note.archived_at
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/{campaign_id}/notes/{note_id}/restore",
    response_model=CampaignNoteOut,
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def restore_campaign_note(
    campaign_id: UUID,
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(CampaignNote, note_id)
    if not note or note.campaign_id != campaign_id:
        raise HTTPException(404, "note not found")
    note.archived_at = None
    note.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(note)
    return note


@router.get(
    "/{campaign_id}/notes/{note_id}/revisions",
    response_model=list[CampaignNoteRevisionOut],
    dependencies=[Depends(require_campaign_role(CAN_MANAGE_CAMPAIGN))],
)
async def list_campaign_note_revisions(
    campaign_id: UUID,
    note_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    note = await db.get(CampaignNote, note_id)
    if not note or note.campaign_id != campaign_id:
        raise HTTPException(404, "note not found")
    res = await db.execute(
        select(CampaignNoteRevision)
        .where(CampaignNoteRevision.note_id == note_id)
        .order_by(CampaignNoteRevision.version_num.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(res.scalars().all())
