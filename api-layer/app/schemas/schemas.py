from pydantic import BaseModel, Field
from typing import Optional, Any
from uuid import UUID
from datetime import datetime

# ---- Shared ----
class IdOut(BaseModel):
    id: UUID

# ---- Users ----
class UserCreate(BaseModel):
    display_name: str
    email: str

class UserOut(IdOut):
    display_name: str
    email: str
    created_at: datetime
    updated_at: datetime

# ---- Games ----
class GameCreate(BaseModel):
    owner_user_id: UUID
    game_name: str

class GameOut(IdOut):
    owner_user_id: UUID
    game_name: str

# ---- Campaign chat ----
class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    whisper_to: Optional[list[UUID]] = None

class ChatMessageOut(IdOut):
    campaign_id: UUID
    user_id: UUID
    message: str
    whisper_to: Optional[list[UUID]]
    created_at: datetime

# ---- Auth ----
class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    # Since your schema has no password table, this is a simple “email login” placeholder.
    # In production you’d do OAuth, email magic link, or password+MFA.
    email: str
    display_name_if_new: Optional[str] = None

class RefreshIn(BaseModel):
    refresh_token: str
