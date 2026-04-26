-- ============================================================
-- Migration 004: Favorites, Teams, Trash, Sidebar, Presence, Theming
-- Run after: 003_add_password_hash.sql
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE favorite_entity_type AS ENUM ('task', 'space', 'doc', 'dashboard', 'view');
CREATE TYPE presence_status AS ENUM ('online', 'away', 'offline', 'dnd');
CREATE TYPE appearance_mode AS ENUM ('light', 'dark', 'auto');

-- ============================================================
-- 2. FAVORITES
-- User-scoped list of favorited entities (task, space, doc, etc.)
-- Position field supports drag-to-reorder
-- ============================================================

CREATE TABLE favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type   favorite_entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_favorites_user ON favorites (user_id, position);

-- ============================================================
-- 3. TEAMS
-- Workspace-scoped teams for grouping members
-- ============================================================

CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  description   TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_teams_workspace ON teams (workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE team_members (
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members (user_id);

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. SIDEBAR CONFIGURATION
-- Per-user per-workspace sidebar layout stored as JSONB
-- ============================================================

CREATE TABLE user_sidebar_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  config        JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id)
);

CREATE INDEX idx_user_sidebar_config_user ON user_sidebar_config (user_id, workspace_id);

-- ============================================================
-- 5. USER PRESENCE
-- Stores last known presence status per user
-- Primary storage is Redis (short TTL), DB is persistence fallback
-- ============================================================

CREATE TABLE user_presence (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status        presence_status NOT NULL DEFAULT 'offline',
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. USER PREFERENCES (THEMING)
-- Per-user appearance settings
-- ============================================================

CREATE TABLE user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accent_color    TEXT NOT NULL DEFAULT '#6366f1'
                  CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  appearance_mode appearance_mode NOT NULL DEFAULT 'auto',
  high_contrast   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. SOFT DELETE — ensure spaces and lists have deleted_at
-- (Already present from 001_initial.sql, this is a no-op guard)
-- Folders table does not exist yet; skip for now.
-- ============================================================

-- spaces.deleted_at already exists
-- lists.deleted_at already exists
-- No folders table in schema yet — will be added in a future migration

-- ============================================================
-- SUMMARY
-- + favorites              (user bookmarks)
-- + teams / team_members   (workspace team grouping)
-- + user_sidebar_config    (per-user sidebar layout)
-- + user_presence          (online/away/dnd/offline)
-- + user_preferences       (theming — accent, appearance, contrast)
-- ============================================================
