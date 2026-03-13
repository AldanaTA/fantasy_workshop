-- security.sql
-- Authentication + identity tables are isolated because:
-- 1) they have different security/auditing requirements
-- 2) they are frequently accessed during login/refresh flows
-- 3) they benefit from partial indexes (active tokens only)

BEGIN;

-- Best practice: enable pgcrypto so we can generate UUIDs in DB when needed.
-- If you generate UUIDs in your application (recommended for UUIDv7), keep this anyway
-- for occasional server-side creation or test data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: emails should be unique (typically case-insensitive).
  -- For true case-insensitive uniqueness, use CITEXT extension; this is a simple baseline.
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- AUTH IDENTITIES (OAuth, etc.)
CREATE TABLE IF NOT EXISTS auth_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: the provider+subject pair is the stable identity, must be unique.
  CONSTRAINT auth_identities_provider_subject_unique UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS auth_identities_user_id_idx
  ON auth_identities(user_id);
-- Why: common query is "load identities for this user".

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  user_agent   TEXT,
  ip_address   INET,
  replaced_by_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Best practice: store only a hash, not the raw token.
  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

-- Best practice: partial index for "active tokens" queries.
-- Login flows typically check active (non-revoked, non-expired) tokens.
CREATE INDEX IF NOT EXISTS refresh_tokens_active_by_user_idx
  ON refresh_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- Optional: quickly find tokens nearing expiry (cleanup jobs).
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
  ON refresh_tokens(expires_at);

COMMIT;
