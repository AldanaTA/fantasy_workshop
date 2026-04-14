export type UUID = string;
export type DateTime = string; // ISO 8601
export type JSONDict = Record<string, any>;

// ---------- SECURITY ----------

export interface User {
	display_name: string
    email: string
    created_at: DateTime
    updated_at: DateTime
}

export type TokenPair = { user_id: UUID; access_token: string; refresh_token: string };

// ---------- CONTENT ----------

export interface Game {
	id: UUID;
	owner_user_id: UUID;
	game_name: string;
}

export interface ContentPack {
	id: UUID;
	game_id: UUID;
	owner_id: UUID;
	campaign_id?: UUID | null;
	pack_name: string;
	description?: string | null;
	visibility: string;
	status: string;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface ContentCategory {
	id: UUID;
	pack_id: UUID;
	name: string;
	sort_key: number;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface Content {
	id: UUID;
	pack_id: UUID;
	category_id: UUID;
	content_type: string;
	name: string;
	summary?: string | null;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface ContentVersion {
	id: UUID;
	content_id: UUID;
	version_num: number;
	fields: JSONDict;
	created_at: DateTime;
}

export interface ContentActiveVersion {
	content_id: UUID;
	active_version_num: number;
	updated_at: DateTime;
	deleted_at?: DateTime | null;
}

// ---------- CAMPAIGNS ----------

export interface Campaign {
	id: UUID;
	game_id: UUID;
	owner_user_id: UUID;
	name: string;
	description?: string | null;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface UserCampaignRole {
	user_id: UUID;
	campaign_id: UUID;
	role: string;
}

export interface Character {
	id: UUID;
	user_id: UUID;
	game_id: UUID;
	name: string;
	sheet: JSONDict;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface CampaignCharacter {
	id: UUID;
	campaign_id: UUID;
	character_id: UUID;
	campaign_overrides: JSONDict;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface CampaignChatMessage {
	id: UUID;
	campaign_id: UUID;
	user_id: UUID;
	whisper_to?: UUID[] | null;
	message: string;
	created_at: DateTime;
}

export interface CampaignContentVersion {
	campaign_id: UUID;
	content_id: UUID;
	pinned_version_num: number;
	pinned_at: DateTime;
}

export interface CampaignEvent {
	id: UUID;
	campaign_id: UUID;
	character_id?: UUID | null;
	user_id?: UUID | null;
	payload: JSONDict;
	content_version_map: JSONDict;
	event_type: string;
	created_at: DateTime;
	idempotency_key: string;
}

export interface CampaignCharacterStateSnapshot {
	id: UUID;
	campaign_id: UUID;
	character_id: UUID;
	latest_event_id: UUID;
	last_event_timestamp: DateTime;
	state: JSONDict;
	created_at: DateTime;
}

export interface CampaignCharacterLatestSnapshot {
	id: UUID;
	character_id: UUID;
	latest_snapshot_id: UUID;
	updated_at: DateTime;
}