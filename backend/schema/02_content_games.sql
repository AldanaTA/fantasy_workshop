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
  created_by_role TEXT NOT NULL DEFAULT 'owner_editor',
  source_campaign_id UUID NULL,
  visibility   content_pack_visibility NOT NULL DEFAULT 'private',
  status       content_pack_status NOT NULL DEFAULT 'draft',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_packs_owner_id_idx ON content_packs(owner_id);
CREATE INDEX IF NOT EXISTS content_packs_game_id_idx ON content_packs(game_id);
CREATE INDEX IF NOT EXISTS content_packs_status_idx ON content_packs(status);
CREATE INDEX IF NOT EXISTS content_packs_campaign_id_idx ON content_packs(campaign_id);
CREATE INDEX IF NOT EXISTS content_packs_source_campaign_id_idx ON content_packs(source_campaign_id);

-- Why: public browsing is common; boolean indexes aren't always useful, but on large sets
-- it can help when combined with other filters; keep if you actually query it often.

-- CONTENT CATEGORIES
CREATE TABLE IF NOT EXISTS content_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_key   INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: avoid duplicates inside a pack.
  CONSTRAINT content_categories_id_pack_uq UNIQUE (id, pack_id),
  CONSTRAINT content_categories_pack_sort_unique UNIQUE (pack_id, sort_key),
  CONSTRAINT content_categories_pack_name_unique UNIQUE (pack_id, name)
);

CREATE INDEX IF NOT EXISTS content_categories_pack_id_idx ON content_categories(pack_id);

CREATE OR REPLACE FUNCTION set_content_category_sort_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sort_key IS NULL THEN
    PERFORM 1
    FROM content_packs
    WHERE id = NEW.pack_id
    FOR UPDATE;

    SELECT COALESCE(MAX(sort_key) + 10, 10)
    INTO NEW.sort_key
    FROM content_categories
    WHERE pack_id = NEW.pack_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_content_category_sort_key ON content_categories;
CREATE TRIGGER trg_set_content_category_sort_key
BEFORE INSERT ON content_categories
FOR EACH ROW
EXECUTE FUNCTION set_content_category_sort_key();

-- CONTENT (stable identity)
CREATE TABLE IF NOT EXISTS content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id      UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_authority TEXT NOT NULL DEFAULT 'owner_editor',
  name         TEXT NOT NULL,
  summary      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_id_pack_uq UNIQUE (id, pack_id)
);

CREATE INDEX IF NOT EXISTS content_pack_id_idx ON content(pack_id);
CREATE INDEX IF NOT EXISTS content_created_by_user_id_idx ON content(created_by_user_id);

-- CONTENT CATEGORY MEMBERSHIPS
-- A content item may appear in many categories, but only once per category.
-- pack_id keeps category/content links inside the same content pack.
CREATE TABLE IF NOT EXISTS content_category_memberships (
  pack_id     UUID NOT NULL,
  category_id UUID NOT NULL,
  content_id  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_category_memberships_pk PRIMARY KEY (category_id, content_id),
  CONSTRAINT content_category_memberships_category_pack_fk
    FOREIGN KEY (category_id, pack_id)
    REFERENCES content_categories(id, pack_id)
    ON DELETE CASCADE,
  CONSTRAINT content_category_memberships_content_pack_fk
    FOREIGN KEY (content_id, pack_id)
    REFERENCES content(id, pack_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS content_category_memberships_pack_id_idx
  ON content_category_memberships(pack_id);
CREATE INDEX IF NOT EXISTS content_category_memberships_content_id_idx
  ON content_category_memberships(content_id);

-- CONTENT VERSIONS (immutable revisions)
CREATE TABLE IF NOT EXISTS content_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  version_num INT NOT NULL,
  fields      JSONB NOT NULL DEFAULT '{
    "schema_version": "ttrpg-content-v1",
    "content_type": "custom",
    "traits": [],
    "requirements": [],
    "mechanics": [],
    "scaling": [],
    "notes": []
  }'::jsonb,

  -- Queryable document envelope. These are generated from fields so the JSON
  -- document remains the portable source of truth for each immutable revision.
  schema_version TEXT GENERATED ALWAYS AS (
    COALESCE(NULLIF(fields->>'schema_version', ''), 'ttrpg-content-v1')
  ) STORED,
  content_type TEXT GENERATED ALWAYS AS (
    COALESCE(NULLIF(fields->>'content_type', ''), 'custom')
  ) STORED,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_versions_content_version_unique UNIQUE (content_id, version_num),
  CONSTRAINT content_versions_fields_object_chk CHECK (jsonb_typeof(fields) = 'object'),
  CONSTRAINT content_versions_mechanics_array_chk CHECK (
    NOT (fields ? 'mechanics') OR jsonb_typeof(fields->'mechanics') = 'array'
  ),
  CONSTRAINT content_versions_scaling_array_chk CHECK (
    NOT (fields ? 'scaling') OR jsonb_typeof(fields->'scaling') = 'array'
  ),
  CONSTRAINT content_versions_traits_array_chk CHECK (
    NOT (fields ? 'traits') OR jsonb_typeof(fields->'traits') = 'array'
  )
);
-- Best practice: fast lookups for "latest version" and "specific version"
CREATE INDEX IF NOT EXISTS content_versions_content_id_version_idx
  ON content_versions(content_id, version_num DESC);
CREATE INDEX IF NOT EXISTS content_versions_created_by_user_id_idx
  ON content_versions(created_by_user_id);
CREATE INDEX IF NOT EXISTS content_versions_content_type_idx
  ON content_versions(content_type);
CREATE INDEX IF NOT EXISTS content_versions_schema_version_idx
  ON content_versions(schema_version);
CREATE INDEX IF NOT EXISTS content_versions_fields_gin_idx
  ON content_versions USING GIN (fields jsonb_path_ops);

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

CREATE TABLE IF NOT EXISTS content_pack_permissions (
  pack_id UUID NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_create_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit_any_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete_any_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_pack BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_pack_permissions_pk PRIMARY KEY (pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS content_pack_permissions_user_id_idx
  ON content_pack_permissions(user_id);

COMMIT;
