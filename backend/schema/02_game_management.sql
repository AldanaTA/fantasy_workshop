-- content_packs.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE game_visibility AS ENUM (
  'private',   -- only owner/collaborators (future)
  'public'     -- Anyone has access to view
);

-- =====================================
-- Games are the top-level entity that contains content packs, campaigns, and characters.
--======================================
CREATE TABLE IF NOT EXISTS games (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_name     TEXT NOT NULL,
  game_summary  TEXT,
  visibility    game_visibility NOT NULL DEFAULT 'private'
);

CREATE INDEX IF NOT EXISTS games_owner_user_id_idx ON games(owner_user_id);
-- Why: list games created by user.

CREATE TYPE content_pack_visibility AS ENUM (
  'private',
  'game',
  'public'
);

CREATE TYPE content_pack_status AS ENUM (
  'draft',
  'published',
  'archived'
);
--=======================================
-- Content Packs are DLC or Expansion to a game.
-- They can be created by the game owner or by a user who has purchased the game.
--=======================================
CREATE TABLE IF NOT EXISTS content_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  game_id UUID NOT NULL
    REFERENCES games(id)
    ON DELETE CASCADE,

  owner_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  campaign_id UUID NULL,

  pack_name TEXT NOT NULL,
  description TEXT,

  created_by_role TEXT NOT NULL DEFAULT 'owner_editor',

  source_campaign_id UUID NULL,

  visibility content_pack_visibility
    NOT NULL DEFAULT 'private',

  status content_pack_status
    NOT NULL DEFAULT 'draft',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_packs_id_game_uq
    UNIQUE (id, game_id),

  CONSTRAINT content_packs_created_by_role_chk
    CHECK (
      created_by_role IN (
        'owner_editor',
        'purchaser'
      )
    )
);

CREATE INDEX IF NOT EXISTS content_packs_owner_id_idx
  ON content_packs(owner_id);

CREATE INDEX IF NOT EXISTS content_packs_game_id_idx
  ON content_packs(game_id);

CREATE INDEX IF NOT EXISTS content_packs_status_idx
  ON content_packs(status);

CREATE INDEX IF NOT EXISTS content_packs_campaign_id_idx
  ON content_packs(campaign_id);

CREATE INDEX IF NOT EXISTS content_packs_source_campaign_id_idx
  ON content_packs(source_campaign_id);


-- ============================================================
-- CONTENT PACK PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS content_pack_permissions (
  pack_id UUID NOT NULL
    REFERENCES content_packs(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  can_create_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit_any_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete_any_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_pack BOOLEAN NOT NULL DEFAULT FALSE,

  granted_by_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_pack_permissions_pk
    PRIMARY KEY (pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS content_pack_permissions_user_id_idx
  ON content_pack_permissions(user_id);

CREATE INDEX IF NOT EXISTS content_pack_permissions_pack_user_idx
  ON content_pack_permissions(pack_id, user_id);

CREATE INDEX IF NOT EXISTS content_pack_permissions_manage_pack_idx
  ON content_pack_permissions(pack_id, can_manage_pack);

COMMIT;