from pydantic import BaseModel, Field, EmailStr
from typing import Optional
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
    sort_key: int = 0

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
    content_type: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    summary: Optional[str] = None

class ContentOut(IdOut):
    pack_id: UUID
    category_id: UUID
    content_type: str
    name: str
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime

# Content versions
class ContentVersionCreate(BaseModel):
    content_id: UUID
    version_num: int = Field(ge=1)
    fields: dict = Field(default_factory=dict)

class ContentVersionOut(IdOut):
    content_id: UUID
    version_num: int
    fields: dict
    created_at: datetime

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