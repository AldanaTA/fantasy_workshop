BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- CONTENT
--
-- Each content item belongs to exactly one category.
-- The category determines the schema used by the item's
-- content versions.
-- ============================================================

CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pack_id UUID NOT NULL
        REFERENCES content_packs(id)
        ON DELETE CASCADE,

    category_id UUID NOT NULL,

    created_by_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    source_authority TEXT NOT NULL DEFAULT 'owner_editor',

    name TEXT NOT NULL,
    summary TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_id_pack_uq
        UNIQUE (id, pack_id),

    CONSTRAINT content_id_category_uq
        UNIQUE (id, category_id),

    -- Ensures the category and content belong to the same pack.
    CONSTRAINT content_category_pack_fk
        FOREIGN KEY (category_id, pack_id)
        REFERENCES content_categories(id, pack_id)
        ON DELETE RESTRICT,

    CONSTRAINT content_source_authority_chk
        CHECK (
            source_authority IN (
                'owner_editor',
                'purchaser'
            )
        )
);

CREATE INDEX IF NOT EXISTS content_pack_id_idx
    ON content(pack_id);

CREATE INDEX IF NOT EXISTS content_category_id_idx
    ON content(category_id);

CREATE INDEX IF NOT EXISTS content_created_by_user_id_idx
    ON content(created_by_user_id);

CREATE INDEX IF NOT EXISTS content_created_by_authority_idx
    ON content(
        pack_id,
        created_by_user_id,
        source_authority
    );


-- ============================================================
-- CONTENT TAGS
--
-- Tags are organizational metadata and do NOT determine the
-- schema of content.
--
-- Tags are scoped to a content pack so different packs may
-- maintain independent tag sets.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pack_id UUID NOT NULL
        REFERENCES content_packs(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_tags_id_pack_uq
        UNIQUE (id, pack_id),

    CONSTRAINT content_tags_pack_name_uq
        UNIQUE (pack_id, name)
);

CREATE INDEX IF NOT EXISTS content_tags_pack_id_idx
    ON content_tags(pack_id);

CREATE INDEX IF NOT EXISTS content_tags_name_idx
    ON content_tags(name);


-- ============================================================
-- CONTENT TAG MEMBERSHIPS
--
-- A content item may have any number of tags.
--
-- pack_id ensures that content cannot accidentally be connected
-- to a tag belonging to another content pack.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_tag_memberships (
    pack_id UUID NOT NULL,

    content_id UUID NOT NULL,
    tag_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_tag_memberships_pk
        PRIMARY KEY (content_id, tag_id),

    CONSTRAINT content_tag_memberships_content_pack_fk
        FOREIGN KEY (content_id, pack_id)
        REFERENCES content(id, pack_id)
        ON DELETE CASCADE,

    CONSTRAINT content_tag_memberships_tag_pack_fk
        FOREIGN KEY (tag_id, pack_id)
        REFERENCES content_tags(id, pack_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS content_tag_memberships_pack_id_idx
    ON content_tag_memberships(pack_id);

CREATE INDEX IF NOT EXISTS content_tag_memberships_tag_id_idx
    ON content_tag_memberships(tag_id);

CREATE INDEX IF NOT EXISTS content_tag_memberships_content_id_idx
    ON content_tag_memberships(content_id);


-- ============================================================
-- CONTENT VERSIONS
--
-- Immutable revisions of a content item.
--
-- Each version remembers exactly which category schema version
-- it was created against.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID NOT NULL,
    category_id UUID NOT NULL,

    category_schema_version INT NOT NULL,

    created_by_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    version_num INT NOT NULL,

    -- Actual user-entered values for the category schema.
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_versions_content_version_unique
        UNIQUE (content_id, version_num),

    CONSTRAINT content_versions_version_num_chk
        CHECK (version_num > 0),

    CONSTRAINT content_versions_content_category_fk
        FOREIGN KEY (content_id, category_id)
        REFERENCES content(id, category_id)
        ON DELETE CASCADE,

    CONSTRAINT content_versions_category_schema_fk
        FOREIGN KEY (
            category_id,
            category_schema_version
        )
        REFERENCES content_category_schemas(
            category_id,
            schema_version
        )
        ON DELETE RESTRICT,

    CONSTRAINT content_versions_fields_object_chk
        CHECK (jsonb_typeof(fields) = 'object')
);

CREATE INDEX IF NOT EXISTS content_versions_content_id_version_idx
    ON content_versions(content_id, version_num DESC);

CREATE INDEX IF NOT EXISTS content_versions_category_idx
    ON content_versions(category_id);

CREATE INDEX IF NOT EXISTS content_versions_schema_idx
    ON content_versions(
        category_id,
        category_schema_version
    );

CREATE INDEX IF NOT EXISTS content_versions_created_by_user_id_idx
    ON content_versions(created_by_user_id);

CREATE INDEX IF NOT EXISTS content_versions_fields_gin_idx
    ON content_versions
    USING GIN (fields jsonb_path_ops);


-- ============================================================
-- ACTIVE CONTENT VERSION
--
-- Points to the version currently displayed by default.
-- ============================================================

CREATE TABLE IF NOT EXISTS content_active_versions (
    content_id UUID PRIMARY KEY
        REFERENCES content(id)
        ON DELETE CASCADE,

    active_version_num INT NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT content_active_versions_version_fk
        FOREIGN KEY (
            content_id,
            active_version_num
        )
        REFERENCES content_versions(
            content_id,
            version_num
        )
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS content_active_versions_active_idx
    ON content_active_versions(content_id)
    WHERE deleted_at IS NULL;

COMMIT;