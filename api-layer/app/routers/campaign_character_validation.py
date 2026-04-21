from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.helpers import require_user
from app.routers.deps import CAN_MANAGE_CAMPAIGN, CAN_READ_CAMPAIGN, get_campaign_role, require_campaign_role
from app.schema.db import get_db
from app.schema.models import CampaignAllowedPack, CampaignCharacter, Character, Content, ContentPack
from app.schema.schemas import (
    CampaignCharacterLoadOut,
    CampaignCharacterOut,
    CampaignCharacterSaveIn,
    CampaignCharacterValidationOut,
    ValidationWarning,
)


router = APIRouter(prefix="/campaigns", tags=["campaign_character_validation"])


def _serialize_campaign_character(row: CampaignCharacter) -> dict:
    return {
        "id": row.id,
        "campaign_id": row.campaign_id,
        "character_id": row.character_id,
        "campaign_overrides": row.campaign_overrides,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _extract_content_references(value, path: str = "$") -> list[tuple[str, UUID]]:
    refs: list[tuple[str, UUID]] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            next_path = f"{path}.{key}"
            if key in {"content_id", "template_content_id"} and isinstance(nested, str):
                try:
                    refs.append((next_path, UUID(nested)))
                except ValueError:
                    continue
            refs.extend(_extract_content_references(nested, next_path))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            refs.extend(_extract_content_references(nested, f"{path}[{index}]"))
    return refs


async def _build_validation(
    db: AsyncSession,
    campaign_id: UUID,
    sheet: dict,
    campaign_overrides: dict,
    actor_role: str,
) -> CampaignCharacterValidationOut:
    refs = _extract_content_references(sheet, "$.sheet")
    refs.extend(_extract_content_references(campaign_overrides, "$.campaign_overrides"))

    allowed_pack_ids = set(
        (
            await db.execute(
                select(CampaignAllowedPack.pack_id).where(
                    CampaignAllowedPack.campaign_id == campaign_id,
                    CampaignAllowedPack.revoked_at.is_(None),
                )
            )
        ).scalars().all()
    )

    warnings: list[ValidationWarning] = []
    for reference_path, content_id in refs:
        content = await db.get(Content, content_id)
        if not content:
            warnings.append(
                ValidationWarning(
                    code="missing_content_reference",
                    message="Referenced content could not be found.",
                    reference_path=reference_path,
                    content_id=content_id,
                )
            )
            continue
        pack = await db.get(ContentPack, content.pack_id)
        if pack is None:
            warnings.append(
                ValidationWarning(
                    code="missing_pack_reference",
                    message="Referenced content pack could not be found.",
                    reference_path=reference_path,
                    content_id=content_id,
                    pack_id=content.pack_id,
                )
            )
            continue
        if pack.id not in allowed_pack_ids:
            warnings.append(
                ValidationWarning(
                    code="disallowed_pack_reference",
                    message="This character references content from a pack not allowed in this campaign.",
                    reference_path=reference_path,
                    content_id=content_id,
                    pack_id=pack.id,
                )
            )

    can_override_save_block = actor_role in CAN_MANAGE_CAMPAIGN
    save_allowed = can_override_save_block or not warnings
    return CampaignCharacterValidationOut(
        status="valid" if not warnings else "warning",
        save_allowed=save_allowed,
        warnings=warnings,
    )


async def _get_campaign_character_pair(
    db: AsyncSession,
    campaign_id: UUID,
    campaign_character_id: UUID,
) -> tuple[CampaignCharacter, Character]:
    campaign_character = await db.get(CampaignCharacter, campaign_character_id)
    if not campaign_character or campaign_character.campaign_id != campaign_id:
        raise HTTPException(404, "campaign character not found")
    character = await db.get(Character, campaign_character.character_id)
    if not character:
        raise HTTPException(404, "character not found")
    return campaign_character, character


@router.get(
    "/{campaign_id}/characters/{campaign_character_id}/validation",
    response_model=CampaignCharacterValidationOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def validate_existing_campaign_character(
    campaign_id: UUID,
    campaign_character_id: UUID,
    role: str = Depends(get_campaign_role),
    db: AsyncSession = Depends(get_db),
):
    campaign_character, character = await _get_campaign_character_pair(db, campaign_id, campaign_character_id)
    return await _build_validation(db, campaign_id, character.sheet, campaign_character.campaign_overrides, role)


@router.get(
    "/{campaign_id}/characters/{campaign_character_id}/load",
    response_model=CampaignCharacterLoadOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def load_campaign_character(
    campaign_id: UUID,
    campaign_character_id: UUID,
    role: str = Depends(get_campaign_role),
    db: AsyncSession = Depends(get_db),
):
    campaign_character, character = await _get_campaign_character_pair(db, campaign_id, campaign_character_id)
    validation = await _build_validation(db, campaign_id, character.sheet, campaign_character.campaign_overrides, role)
    return CampaignCharacterLoadOut(
        campaign_character=_serialize_campaign_character(campaign_character),
        character=character,
        validation=validation,
    )


@router.put(
    "/{campaign_id}/characters/{campaign_character_id}/save",
    response_model=CampaignCharacterLoadOut,
    dependencies=[Depends(require_campaign_role(CAN_READ_CAMPAIGN))],
)
async def save_campaign_character(
    campaign_id: UUID,
    campaign_character_id: UUID,
    payload: CampaignCharacterSaveIn,
    user=Depends(require_user),
    role: str = Depends(get_campaign_role),
    db: AsyncSession = Depends(get_db),
):
    campaign_character, character = await _get_campaign_character_pair(db, campaign_id, campaign_character_id)
    actor_id = UUID(user["uid"])

    if role not in CAN_MANAGE_CAMPAIGN and character.user_id != actor_id:
        raise HTTPException(403, "you may only save your own campaign character")

    validation = await _build_validation(db, campaign_id, payload.sheet, payload.campaign_overrides, role)
    if not validation.save_allowed:
        raise HTTPException(status_code=422, detail=validation.model_dump())

    character.sheet = payload.sheet
    character.updated_at = datetime.now(timezone.utc)
    campaign_character.campaign_overrides = payload.campaign_overrides
    campaign_character.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(character)
    await db.refresh(campaign_character)

    return CampaignCharacterLoadOut(
        campaign_character=_serialize_campaign_character(campaign_character),
        character=character,
        validation=validation,
    )
