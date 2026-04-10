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

CREATE INDEX IF NOT EXISTS content_packs_campaign_id_idx ON content_packs(campaign_id);

CREATE TYPE campaign_role as enum (
  'Co-GM',
  'player',
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
  ON campaign_chat_messages(campaign_id, created_at DESC);
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

-- EVENT TYPE (placeholder custom type)
-- Best practice: enum ensures only known event types are stored.
-- You said you'll use custom types; you can expand this enum or replace with a domain.
CREATE TYPE campaign_event_type AS ENUM (
  'damage',
  'heal',
  'set_hp',
  'add_condition',
  'remove_condition',
  'set_resource',
  'spend_resource',
  'gain_resource',
  'add_item',
  'remove_item',
  'note',
  'custom',
  'unknown'
);

-- CAMPAIGN EVENT LOG (append-only)
CREATE TABLE IF NOT EXISTS campaign_event (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id       UUID REFERENCES campaign_characters(id) ON DELETE SET NULL,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_version_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_type         campaign_event_type NOT NULL DEFAULT 'unknown',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key    TEXT NOT NULL
);

-- Best practice: enforce idempotency per campaign so retries don't duplicate events.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_event_campaign_id_idempotency_key_uq
  ON campaign_event(campaign_id, idempotency_key);

-- Best practice: your hottest query is "events for campaign ordered by time".
CREATE INDEX IF NOT EXISTS campaign_event_campaign_id_created_at_idx
  ON campaign_event(campaign_id, created_at);

-- Best practice: when hydrating a character, you often query events by character within campaign.
CREATE INDEX IF NOT EXISTS campaign_event_campaign_character_created_at_idx
  ON campaign_event(campaign_id, character_id, created_at);

-- SNAPSHOTS (history)
CREATE TABLE IF NOT EXISTS campaign_character_state_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id          UUID NOT NULL REFERENCES campaign_characters(id) ON DELETE CASCADE,
  latest_event_id       UUID NOT NULL REFERENCES campaign_event(id) ON DELETE RESTRICT,
  last_event_timestamp  TIMESTAMPTZ NOT NULL,
  state                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Best practice: load latest snapshot fast for a campaign+character.
CREATE INDEX IF NOT EXISTS campaign_character_snapshots_latest_idx
  ON campaign_character_state_snapshots(campaign_id, character_id, last_event_timestamp DESC);

-- LATEST SNAPSHOT POINTER
CREATE TABLE IF NOT EXISTS campaign_character_latest_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id      UUID NOT NULL REFERENCES campaign_characters(id) ON DELETE CASCADE,
  latest_snapshot_id UUID NOT NULL REFERENCES campaign_character_state_snapshots(id) ON DELETE CASCADE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: one pointer row per character.
  CONSTRAINT campaign_character_latest_snapshots_character_unique UNIQUE (character_id)
);

COMMIT;

CREATE OR REPLACE FUNCTION prune_old_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- keep only the latest 5 snapshots per campaign+character
  DELETE FROM campaign_character_state_snapshots s
  WHERE s.campaign_id = NEW.campaign_id
    AND s.character_id = NEW.character_id
    AND s.id NOT IN (
      SELECT id
      FROM campaign_character_state_snapshots
      WHERE campaign_id = NEW.campaign_id
        AND character_id = NEW.character_id
      ORDER BY last_event_timestamp DESC
      LIMIT 5
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_old_snapshots ON campaign_character_state_snapshots;

CREATE TRIGGER trg_prune_old_snapshots
AFTER INSERT ON campaign_character_state_snapshots
FOR EACH ROW
EXECUTE FUNCTION prune_old_snapshots();
