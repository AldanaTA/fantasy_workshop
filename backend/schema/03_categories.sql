BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- CONTENT CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS content_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pack_id    UUID NOT NULL
        REFERENCES content_packs(id)
        ON DELETE CASCADE,

    name       TEXT NOT NULL,
    sort_key   INT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_categories_id_pack_uq
        UNIQUE (id, pack_id),

    CONSTRAINT content_categories_pack_sort_unique
        UNIQUE (pack_id, sort_key),

    CONSTRAINT content_categories_pack_name_unique
        UNIQUE (pack_id, name)
);

CREATE INDEX IF NOT EXISTS content_categories_pack_id_idx
    ON content_categories(pack_id);


-- ============================================================
-- AUTOMATIC CATEGORY SORT KEY
-- ============================================================

CREATE OR REPLACE FUNCTION set_content_category_sort_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sort_key IS NULL THEN

        -- Prevent simultaneous category creation from generating
        -- the same sort key within a content pack.
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


DROP TRIGGER IF EXISTS trg_set_content_category_sort_key
    ON content_categories;

CREATE TRIGGER trg_set_content_category_sort_key
BEFORE INSERT ON content_categories
FOR EACH ROW
EXECUTE FUNCTION set_content_category_sort_key();


-- ============================================================
-- CATEGORY SCHEMA VERSIONS
--
-- Each category defines the structure of content belonging
-- to that category.
--
-- Schemas are immutable once created.
-- Editing a category schema should create a new version.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_category_schemas (
    category_id UUID NOT NULL
        REFERENCES content_categories(id)
        ON DELETE CASCADE,

    schema_version INT NOT NULL,

    -- Schema definition created by the frontend.
    schema_definition JSONB NOT NULL,

    created_by_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_category_schemas_pk
        PRIMARY KEY (category_id, schema_version),

    CONSTRAINT content_category_schemas_version_chk
        CHECK (schema_version > 0),

    CONSTRAINT content_category_schemas_definition_object_chk
        CHECK (jsonb_typeof(schema_definition) = 'object')
);

CREATE INDEX IF NOT EXISTS content_category_schemas_category_idx
    ON content_category_schemas(category_id, schema_version DESC);


-- ============================================================
-- ACTIVE CATEGORY SCHEMA
--
-- Determines which schema new content/content versions should
-- normally use.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_category_active_schemas (
    category_id UUID PRIMARY KEY
        REFERENCES content_categories(id)
        ON DELETE CASCADE,

    schema_version INT NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_category_active_schema_fk
        FOREIGN KEY (category_id, schema_version)
        REFERENCES content_category_schemas(
            category_id,
            schema_version
        )
        ON DELETE RESTRICT
);

COMMIT;