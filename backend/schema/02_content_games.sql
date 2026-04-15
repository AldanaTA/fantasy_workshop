-- content.sql
-- Content tables are separated because:
-- 1) they are read-heavy
-- 2) they benefit from versioning constraints/indexes
-- 3) they may be managed/published independently (DLC/homebrew model)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE game_visibility AS ENUM (
  'private',   -- only owner/collaborators (future)
  'public'     -- Anyone has access to view
);

-- GAMES
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
  'private',   -- only owner/collaborators (future)
  'game',      -- visible within the game (published)
  'public'     -- future marketplace/community
);

CREATE TYPE content_pack_status AS ENUM (
  'draft',     -- editable, not considered "stable"
  'published', -- stable release
  'archived'   -- hidden/inactive
);

-- CONTENT PACKS (always game-scoped; may optionally be associated to a campaign in same game)
CREATE TABLE IF NOT EXISTS content_packs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE, -- fixed REFERENCES
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- optional association for "this pack was made for campaign X"
  campaign_id  UUID NULL,

  pack_name    TEXT NOT NULL,
  description  TEXT,
  visibility   content_pack_visibility NOT NULL DEFAULT 'private',
  status       content_pack_status NOT NULL DEFAULT 'draft',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_packs_owner_id_idx ON content_packs(owner_id);
CREATE INDEX IF NOT EXISTS content_packs_game_id_idx ON content_packs(game_id);
CREATE INDEX IF NOT EXISTS content_packs_status_idx ON content_packs(status);
CREATE INDEX IF NOT EXISTS content_packs_campaign_id_idx ON content_packs(campaign_id);

-- Why: public browsing is common; boolean indexes aren't always useful, but on large sets
-- it can help when combined with other filters; keep if you actually query it often.

-- CONTENT CATEGORIES
CREATE TABLE IF NOT EXISTS content_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_key   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: avoid duplicates inside a pack.
  CONSTRAINT content_categories_id_pack_uq UNIQUE (id, pack_id),
  CONSTRAINT content_categories_pack_sort_unique UNIQUE (pack_id, sort_key),
  CONSTRAINT content_categories_pack_name_unique UNIQUE (pack_id, name)
);

CREATE INDEX IF NOT EXISTS content_categories_pack_id_idx ON content_categories(pack_id);

-- CONTENT (stable identity)
CREATE TABLE IF NOT EXISTS content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id      UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL,
  content_type TEXT NOT NULL,
  name         TEXT NOT NULL,
  summary      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_category_same_pack_fk
    FOREIGN KEY (category_id, pack_id)
    REFERENCES content_categories(id, pack_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS content_pack_id_idx ON content(pack_id);
CREATE INDEX IF NOT EXISTS content_category_id_idx ON content(category_id);
CREATE INDEX IF NOT EXISTS content_type_idx ON content(content_type);

-- CONTENT VERSIONS (immutable revisions)
CREATE TABLE IF NOT EXISTS content_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,

  version_num INT NOT NULL,
  fields      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_versions_content_version_unique UNIQUE (content_id, version_num)
);
-- Best practice: fast lookups for "latest version" and "specific version"
CREATE INDEX IF NOT EXISTS content_versions_content_id_version_idx
  ON content_versions(content_id, version_num DESC);

-- CONTENT ACTIVE VERSIONS (global default per content)
CREATE TABLE IF NOT EXISTS content_active_versions (
  content_id         UUID PRIMARY KEY REFERENCES content(id) ON DELETE CASCADE,
  active_version_num INT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,

  FOREIGN KEY (content_id, active_version_num)
    REFERENCES content_versions(content_id, version_num)
    ON DELETE RESTRICT
);

-- Fast lookup of active pointers
CREATE INDEX IF NOT EXISTS content_active_versions_active_idx
  ON content_active_versions(content_id)
  WHERE deleted_at IS NULL;

COMMIT;
