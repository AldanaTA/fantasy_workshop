from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Any, Optional
from uuid import UUID
from datetime import datetime

class IdOut(BaseModel):
    id: UUID

# Users

class UserCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)

class UserOut(IdOut):
    display_name: str
    email: str
    created_at: datetime
    updated_at: datetime

# Auth identities
class AuthIdentityCreate(BaseModel):
    user_id: UUID
    provider: str
    provider_subject: str

class AuthIdentityOut(IdOut):
    user_id: UUID
    provider: str
    provider_subject: str
    created_at: datetime
    updated_at: datetime

# Games
class GameCreate(BaseModel):
    game_name: str = Field(min_length=1, max_length=200)
    game_summary: Optional[str] = None
    visibility: str = "private"

class GameOut(IdOut):
    owner_user_id: UUID
    game_name: str
    game_summary: Optional[str]
    visibility: str

class LibraryGameOut(GameOut):
    role: str

class GameShareLinkCreate(BaseModel):
    role: str = "purchaser"
    expires_in_days: int = Field(default=7, ge=1, le=90)
    max_uses: Optional[int] = Field(default=10, ge=1, le=1000)

class GameShareLinkOut(IdOut):
    game_id: UUID
    token: str
    url: Optional[str] = None
    role: str
    expires_at: datetime
    max_uses: Optional[int]
    uses_count: int
    revoked_at: Optional[datetime]
    created_at: datetime

class GameSharePreview(BaseModel):
    game_id: UUID
    game_name: str
    game_summary: Optional[str]
    role: str
    expires_at: datetime
    is_expired: bool
    is_revoked: bool
    is_usable: bool

class GameShareAcceptResult(BaseModel):
    game_id: UUID
    role: str
    status: str

# Content pack
class ContentPackCreate(BaseModel):
    game_id: UUID
    owner_id: UUID
    campaign_id: Optional[UUID] = None
    pack_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    visibility: str = "private"
    status: str = "draft"

class ContentPackOut(IdOut):
    game_id: UUID
    owner_id: UUID
    campaign_id: Optional[UUID]
    pack_name: str
    description: Optional[str]
    visibility: str
    status: str
    created_at: datetime
    updated_at: datetime

# Content category
class ContentCategoryCreate(BaseModel):
    pack_id: UUID
    name: str = Field(min_length=1, max_length=200)
    sort_key: Optional[int] = None

class ContentCategoryOrderUpdate(BaseModel):
    category_ids: list[UUID]

class ContentCategoryOut(IdOut):
    pack_id: UUID
    name: str
    sort_key: int
    created_at: datetime
    updated_at: datetime

# Content
class ContentCreate(BaseModel):
    pack_id: UUID
    category_id: UUID
    name: str = Field(min_length=1, max_length=200)
    summary: Optional[str] = None

class ContentOut(IdOut):
    pack_id: UUID
    name: str
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime

class ContentCategoryMembershipCreate(BaseModel):
    pack_id: UUID
    category_id: UUID
    content_id: UUID

class ContentCategoryMembershipOut(BaseModel):
    pack_id: UUID
    category_id: UUID
    content_id: UUID
    created_at: datetime

# Content versions
TTRPG_CONTENT_SCHEMA_VERSION = "ttrpg-content-v1"

def default_content_fields() -> dict[str, Any]:
    return {
        "schema_version": TTRPG_CONTENT_SCHEMA_VERSION,
        "content_type": "custom",
        "traits": [],
        "requirements": [],
        "mechanics": [],
        "scaling": [],
        "notes": [],
    }

def validate_content_fields_shape(fields: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(fields, dict):
        raise ValueError("fields must be a JSON object")

    schema_version = fields.get("schema_version")
    if not isinstance(schema_version, str) or not schema_version.strip():
        raise ValueError("fields.schema_version is required")

    content_type = fields.get("content_type")
    if not isinstance(content_type, str) or not content_type.strip():
        raise ValueError("fields.content_type is required")

    for key in ("mechanics", "scaling", "traits"):
        if key in fields and not isinstance(fields[key], list):
            raise ValueError(f"fields.{key} must be an array")

    for index, effect in enumerate(fields.get("mechanics", []), start=1):
        if not isinstance(effect, dict):
            raise ValueError(f"fields.mechanics[{index}] must be an object")
        effect_type = effect.get("type")
        if not isinstance(effect_type, str) or not effect_type.strip():
            raise ValueError(f"fields.mechanics[{index}].type is required")

    return fields

class ContentVersionCreate(BaseModel):
    content_id: Optional[UUID] = None
    version_num: Optional[int] = Field(default=None, ge=1)
    fields: dict[str, Any] = Field(default_factory=default_content_fields)

    @field_validator("fields")
    @classmethod
    def validate_fields(cls, fields: dict[str, Any]) -> dict[str, Any]:
        return validate_content_fields_shape(fields)

class ContentVersionOut(IdOut):
    content_id: UUID
    version_num: int
    fields: dict[str, Any]
    schema_version: str
    content_type: str
    created_at: datetime

class ContentWithActiveVersionOut(BaseModel):
    content: ContentOut
    active_version: Optional[ContentVersionOut] = None
    error: Optional[str] = None

# Active version pointer
class ContentActiveVersionUpsert(BaseModel):
    content_id: UUID
    active_version_num: int = Field(ge=1)
    deleted_at: Optional[datetime] = None

class ContentActiveVersionOut(BaseModel):
    content_id: UUID
    active_version_num: int
    updated_at: datetime
    deleted_at: Optional[datetime]

# Campaigns
class CampaignCreate(BaseModel):
    game_id: UUID
    owner_user_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None

class CampaignOut(IdOut):
    game_id: UUID
    owner_user_id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

# Campaign roles (composite PK)
class UserCampaignRoleUpsert(BaseModel):
    user_id: UUID
    campaign_id: UUID
    role: str = Field(min_length=1, max_length=50)

class UserCampaignRoleOut(BaseModel):
    user_id: UUID
    campaign_id: UUID
    role: str

# Characters
class CharacterCreate(BaseModel):
    user_id: UUID
    game_id: UUID
    name: str = Field(min_length=1, max_length=200)
    sheet: dict = Field(default_factory=dict)

class CharacterOut(IdOut):
    user_id: UUID
    game_id: UUID
    name: str
    sheet: dict
    created_at: datetime
    updated_at: datetime

# Campaign characters
class CampaignCharacterCreate(BaseModel):
    campaign_id: UUID
    character_id: UUID
    campaign_overrides: dict = Field(default_factory=dict)

class CampaignCharacterOut(IdOut):
    campaign_id: UUID
    character_id: UUID
    campaign_overrides: dict
    created_at: datetime
    updated_at: datetime

# Chat
class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    whisper_to: Optional[list[UUID]] = None

class ChatMessageCreate(BaseModel):
    campaign_id: UUID
    user_id: UUID
    whisper_to: Optional[list[UUID]] = None
    message: str = Field(min_length=1, max_length=4000)

class ChatMessageOut(IdOut):
    campaign_id: UUID
    user_id: UUID
    whisper_to: Optional[list[UUID]]
    message: str
    created_at: datetime

# Campaign content pins
class CampaignContentVersionUpsert(BaseModel):
    campaign_id: UUID
    content_id: UUID
    pinned_version_num: int = Field(ge=1)

class CampaignContentVersionOut(BaseModel):
    campaign_id: UUID
    content_id: UUID
    pinned_version_num: int
    pinned_at: datetime

# Campaign events
class CampaignEventCreate(BaseModel):
    campaign_id: UUID
    character_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    payload: dict = Field(default_factory=dict)
    content_version_map: dict = Field(default_factory=dict)
    event_type: str = Field(min_length=1, max_length=100)
    idempotency_key: str = Field(min_length=8, max_length=200)

class CampaignEventOut(IdOut):
    campaign_id: UUID
    character_id: Optional[UUID]
    user_id: Optional[UUID]
    payload: dict
    content_version_map: dict
    event_type: str
    idempotency_key: str
    created_at: datetime

# Snapshots
class CampaignCharacterStateSnapshotCreate(BaseModel):
    campaign_id: UUID
    character_id: UUID
    latest_event_id: UUID
    last_event_timestamp: datetime
    state: dict = Field(default_factory=dict)

class CampaignCharacterStateSnapshotOut(IdOut):
    campaign_id: UUID
    character_id: UUID
    latest_event_id: UUID
    last_event_timestamp: datetime
    state: dict
    created_at: datetime

class CampaignCharacterLatestSnapshotCreate(BaseModel):
    character_id: UUID
    latest_snapshot_id: UUID

class CampaignCharacterLatestSnapshotOut(IdOut):
    character_id: UUID
    latest_snapshot_id: UUID
    updated_at: datetime

# Auth
class AuthUser(BaseModel):
    email: str
    display_name: str

class TokenPairOut(BaseModel):
    user_id: UUID
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    email: str
    display_name_if_new: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)

class RefreshIn(BaseModel):
    refresh_token: str

#--- INVITES ----------
class InviteCreate(BaseModel):
    email: EmailStr
    target_type: str  # "campaign" or "game"
    target_id: UUID
    role: str

class InviteAccept(BaseModel):
    token: str
