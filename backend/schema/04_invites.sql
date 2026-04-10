CREATE TYPE invite_target_type AS ENUM (
  'campaign',
  'game'
);

CREATE TYPE game_role AS ENUM (
  'editor',
  'purchaser',
);

CREATE TYPE invite_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'expired'
);

CREATE TYPE invitee_roles AS ENUM (
  'editor',
  'viewer',
  'Co-GM',
  'player',
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL, -- allows inviting users not signed up yet
  invitee_user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,

  target_type invite_target_type NOT NULL,
  target_id UUID NOT NULL, -- campaign_id OR game_id

  role campaign_role NOT NULL, -- e.g. "player", "co-dm", "editor"

  token TEXT NOT NULL UNIQUE, -- secure random token for invite link

  status invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- GAME ROLES (for sharing games)
CREATE TABLE user_game_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  role game_role NOT NULL,

  PRIMARY KEY (user_id, game_id)
);