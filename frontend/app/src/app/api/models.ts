import { Visibility } from "../types/visibility";
import { Status} from "../types/status";
import { JSONDict,UUID,DateTime } from "../types/misc";
import { ContentFields } from "../types/contentFields";



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
	game_summary?: string | null;
	visibility: Visibility;
}

export type GameLibraryRole = "owner" | "editor" | "purchaser" | "viewer" | string;

export interface LibraryGame extends Game {
	role?: GameLibraryRole;
}

export interface GameCreate {
	owner_user_id: UUID;
	game_name: string;
	game_summary?: string | null;
	visibility: Visibility;
}

export interface GameShareLink {
	id: UUID;
	game_id: UUID;
	token: string;
	url?: string;
	role: string;
	expires_at: DateTime;
	max_uses?: number | null;
	uses_count: number;
	revoked_at?: DateTime | null;
	created_at: DateTime;
}

export interface GameShareLinkCreate {
	role?: string;
	expires_in_days?: number;
	max_uses?: number | null;
}

export interface GameSharePreview {
	game_id: UUID;
	game_name: string;
	game_summary?: string | null;
	role: string;
	expires_at: DateTime;
	is_expired: boolean;
	is_revoked: boolean;
	is_usable: boolean;
}

export interface GameShareAcceptResult {
	game_id: UUID;
	role: string;
	status: string;
}

export interface ContentPack {
	id: UUID;
	game_id: UUID;
	owner_id: UUID;
	campaign_id?: UUID | null;
	created_by_role: string;
	source_campaign_id?: UUID | null;
	pack_name: string;
	description?: string | null;
	visibility: Visibility;
	status: Status;
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
	created_by_user_id: UUID;
	source_authority: string;
	name: string;
	summary?: string | null;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface ContentCreate {
	pack_id: UUID;
	category_id: UUID;
	name: string;
	summary?: string | null;
}

export interface ContentCategoryMembership {
	pack_id: UUID;
	category_id: UUID;
	content_id: UUID;
	created_at: DateTime;
}

export interface ContentCategoryMembershipCreate {
	pack_id: UUID;
	category_id: UUID;
	content_id: UUID;
}

export interface ContentVersion {
	id: UUID;
	content_id: UUID;
	created_by_user_id: UUID;
	version_num: number;
	fields: ContentFields;
	schema_version?: string;
	content_type?: string;
	created_at: DateTime;
}

export interface ContentVersionCreate {
	fields: ContentFields;
	version_num?: number;
}

export interface ContentActiveVersion {
	content_id: UUID;
	active_version_num: number;
	updated_at: DateTime;
	deleted_at?: DateTime | null;
}

export interface ContentWithActiveVersion {
	content: Content;
	active_version?: ContentVersion | null;
	error?: string | null;
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

export interface CharacterSheetInstance {
	template_content_id?: UUID;
	template_version_num?: number;
	values: JSONDict;
}

export interface Character {
	id: UUID;
	user_id: UUID;
	game_id: UUID;
	name: string;
	sheet: CharacterSheetInstance | JSONDict;
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

export interface CampaignNote {
	id: UUID;
	campaign_id: UUID;
	title: string;
	body: JSONDict;
	visibility: "gm" | "shared" | string;
	created_by_user_id: UUID;
	updated_by_user_id: UUID;
	version_num: number;
	archived_at?: DateTime | null;
	created_at: DateTime;
	updated_at: DateTime;
}

export interface CampaignNoteRevision {
	note_id: UUID;
	version_num: number;
	title: string;
	body: JSONDict;
	visibility: "gm" | "shared" | string;
	updated_by_user_id: UUID;
	created_at: DateTime;
}

export interface CampaignAllowedPack {
	campaign_id: UUID;
	pack_id: UUID;
	game_id: UUID;
	allowed_by_user_id: UUID;
	created_at: DateTime;
	revoked_at?: DateTime | null;
}

export interface ValidationWarning {
	code: string;
	message: string;
	reference_path?: string | null;
	content_id?: UUID | null;
	pack_id?: UUID | null;
}

export interface CampaignCharacterValidation {
	status: "valid" | "warning" | string;
	save_allowed: boolean;
	warnings: ValidationWarning[];
}

export interface CampaignCharacterLoad {
	campaign_character: CampaignCharacter;
	character: Character;
	validation: CampaignCharacterValidation;
}

export interface CampaignChatMessage {
	id: UUID;
	campaign_id: UUID;
	user_id: UUID;
	whisper_to?: UUID[] | null;
	message: string;
	created_at: DateTime;
}

export interface CampaignChatMessagePage {
	items: CampaignChatMessage[];
	next_before_created_at?: DateTime | null;
	next_before_id?: UUID | null;
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
