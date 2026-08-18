-- campaigns.sql
-- Campaign/runtime tables are separated because:
-- 1) they are write-heavy (events, chat)
-- 2) they need careful indexing to avoid hotspots
-- 3) partitioning strategies usually apply here first (especially campaign_event)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CAMPAIGNS
-- CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enables composite FK targets (pack campaign_id must match pack.game_id)
  CONSTRAINT campaigns_id_game_uq UNIQUE (id, game_id)
);

CREATE INDEX IF NOT EXISTS campaigns_game_id_idx ON campaigns(game_id);
CREATE INDEX IF NOT EXISTS campaigns_owner_user_id_idx ON campaigns(owner_user_id);

-- Now that campaigns exist, add the FK from content_packs.campaign_id
-- (avoids circular dependency between content.sql and campaigns.sql).
-- Enforce: if content_packs.campaign_id is set, it must be a campaign in the same game_id
ALTER TABLE content_packs
  ADD CONSTRAINT content_packs_campaign_game_fk
  FOREIGN KEY (campaign_id, game_id)
  REFERENCES campaigns(id, game_id)
  ON DELETE SET NULL;

ALTER TABLE content_packs
  ADD CONSTRAINT content_packs_source_campaign_fk
  FOREIGN KEY (source_campaign_id)
  REFERENCES campaigns(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_packs_campaign_id_idx ON content_packs(campaign_id);

CREATE TYPE campaign_role as enum (
  'co_gm',
  'player'
);
-- USER CAMPAIGN ROLES
CREATE TABLE IF NOT EXISTS user_campaign_roles (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  role        campaign_role NOT NULL,

  -- Best practice: one role row per user per campaign (simple & prevents duplicates).
  CONSTRAINT user_campaign_roles_pk PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS user_campaign_roles_campaign_id_idx
  ON user_campaign_roles(campaign_id);

-- CHARACTERS (owned templates, tied to a game)
CREATE TABLE IF NOT EXISTS characters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sheet      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS characters_user_id_idx ON characters(user_id);
CREATE INDEX IF NOT EXISTS characters_game_id_idx ON characters(game_id);

-- CAMPAIGN CHARACTERS (character instantiated into campaign with overrides)
-- Overrides include unique effects or changes to the character's sheet that only apply in this campaign.
CREATE TABLE IF NOT EXISTS campaign_characters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id        UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  campaign_overrides  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: prevent same character added twice to same campaign.
  CONSTRAINT campaign_characters_campaign_character_unique UNIQUE (campaign_id, character_id)
);

CREATE INDEX IF NOT EXISTS campaign_characters_campaign_id_idx ON campaign_characters(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_characters_character_id_idx ON campaign_characters(character_id);

CREATE TYPE campaign_note_visibility AS ENUM (
  'gm',
  'shared'
);

CREATE TABLE IF NOT EXISTS campaign_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '{"schema_version":"campaign_note_doc_v1","type":"doc","content":[]}'::jsonb,
  visibility campaign_note_visibility NOT NULL DEFAULT 'gm',
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version_num INT NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT campaign_notes_body_object_chk CHECK (jsonb_typeof(body) = 'object'),
  CONSTRAINT campaign_notes_version_num_positive_chk CHECK (version_num >= 1)
);

CREATE INDEX IF NOT EXISTS campaign_notes_campaign_updated_idx
  ON campaign_notes(campaign_id, archived_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS campaign_notes_campaign_archived_updated_id_idx
  ON campaign_notes(campaign_id, archived_at, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS campaign_note_revisions (
  note_id UUID NOT NULL REFERENCES campaign_notes(id) ON DELETE CASCADE,
  version_num INT NOT NULL,
  title TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '{"schema_version":"campaign_note_doc_v1","type":"doc","content":[]}'::jsonb,
  visibility campaign_note_visibility NOT NULL DEFAULT 'gm',
  updated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_note_revisions_pk PRIMARY KEY (note_id, version_num)
);

CREATE INDEX IF NOT EXISTS campaign_note_revisions_note_version_idx
  ON campaign_note_revisions(note_id, version_num DESC);
CREATE INDEX IF NOT EXISTS campaign_note_revisions_note_created_id_idx
  ON campaign_note_revisions(note_id, created_at DESC, version_num DESC);

CREATE TABLE IF NOT EXISTS campaign_allowed_packs (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  game_id UUID NOT NULL,
  allowed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT campaign_allowed_packs_pk PRIMARY KEY (campaign_id, pack_id),
  CONSTRAINT campaign_allowed_packs_campaign_game_fk
    FOREIGN KEY (campaign_id, game_id)
    REFERENCES campaigns(id, game_id)
    ON DELETE CASCADE,
  CONSTRAINT campaign_allowed_packs_pack_game_fk
    FOREIGN KEY (pack_id, game_id)
    REFERENCES content_packs(id, game_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS campaign_allowed_packs_active_campaign_idx
  ON campaign_allowed_packs(campaign_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS campaign_allowed_packs_active_pack_idx
  ON campaign_allowed_packs(pack_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS campaign_allowed_packs_active_lookup_idx
  ON campaign_allowed_packs(campaign_id, pack_id)
  WHERE revoked_at IS NULL;

-- CAMPAIGN CHAT MESSAGES
CREATE TABLE IF NOT EXISTS campaign_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whisper_to  UUID[], -- If you query "messages whispered to me", use a GIN index below
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_chat_messages_campaign_id_created_at_idx
  ON campaign_chat_messages(campaign_id, created_at DESC, id DESC);
-- Why: chats are usually loaded as "latest N messages in a campaign".

-- Best practice: array membership queries need GIN.
-- Keep only if you actually implement whisper filtering by recipient.
CREATE INDEX IF NOT EXISTS campaign_chat_messages_whisper_to_gin_idx
  ON campaign_chat_messages USING GIN (whisper_to);

-- CAMPAIGN CONTENT VERSION PINNING (campaign chooses specific versions)
CREATE TABLE IF NOT EXISTS campaign_content_versions (
  campaign_id        UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id         UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  pinned_version_num INT NOT NULL,
  pinned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT campaign_content_versions_pk PRIMARY KEY (campaign_id, content_id),

  FOREIGN KEY (content_id, pinned_version_num)
    REFERENCES content_versions(content_id, version_num)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS campaign_content_versions_campaign_id_idx
  ON campaign_content_versions(campaign_id);

-- ============================================================
-- CAMPAIGN CHARACTER STATE
--
-- Stores the current runtime state of a character during a
-- campaign.
--
-- The frontend is responsible for calculating changes to this
-- state. The backend simply persists the latest state.
--
-- The frontend should periodically save this state and also
-- save after important actions to reduce data loss if a client
-- disconnects.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_character_states (
    campaign_character_id UUID PRIMARY KEY
        REFERENCES campaign_characters(id)
        ON DELETE CASCADE,

    state JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Incremented whenever the state is saved.
    -- Useful for detecting stale updates from multiple clients.
    version_num BIGINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT campaign_character_states_state_object_chk
        CHECK (jsonb_typeof(state) = 'object'),

    CONSTRAINT campaign_character_states_version_positive_chk
        CHECK (version_num >= 1)
);

CREATE INDEX IF NOT EXISTS campaign_character_states_updated_at_idx
    ON campaign_character_states(updated_at DESC);

COMMIT;