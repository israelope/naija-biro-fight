-- Naija Biro Fight database schema (Neon / PostgreSQL).
-- Paste this whole file into the Neon SQL Editor and press Run. It is safe to run again.

CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text,
  avatar           int  NOT NULL DEFAULT 0,
  school           text,
  state            text,
  pin_hash         text,
  pin_salt         text,
  failed_attempts  int  NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  coins            int  NOT NULL DEFAULT 100,
  wins             int  NOT NULL DEFAULT 0,
  losses           int  NOT NULL DEFAULT 0,
  ai_wins          int  NOT NULL DEFAULT 0,
  heavy_moves      int  NOT NULL DEFAULT 0,
  streak           int  NOT NULL DEFAULT 0,
  last_daily       date,
  first_match_date date,
  earn_date        date,
  earned_today     int  NOT NULL DEFAULT 0,
  ai_earned_today  int  NOT NULL DEFAULT 0,
  loadout          jsonb NOT NULL DEFAULT '{"cover":"cover-1","weight":"weight-0","tip":"tip-std","skin":"skin-blue"}',
  table_id         text NOT NULL DEFAULT 'table-classroom',
  banned           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_wins_idx ON users (wins DESC);

CREATE TABLE IF NOT EXISTS inventory (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id          uuid PRIMARY KEY,
  room_code   text,
  player1_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  player2_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  winner_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  score1      int NOT NULL DEFAULT 0,
  score2      int NOT NULL DEFAULT 0,
  heavy1      int NOT NULL DEFAULT 0,
  heavy2      int NOT NULL DEFAULT 0,
  coins1      int NOT NULL DEFAULT 0,
  coins2      int NOT NULL DEFAULT 0,
  forfeit     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_p1_idx ON matches (player1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_p2_idx ON matches (player2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_created_idx ON matches (created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id            bigserial PRIMARY KEY,
  reporter_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_name text NOT NULL,
  reason        text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
