-- ============================================================
-- MIGRATION 009 — Wave 4 Features
-- Multiple assignees, user/workspace preferences, ClickApps,
-- favorites, recently viewed, comment assignments,
-- task public links, pinned tasks, timesheets helper view
-- ============================================================

-- ============================================================
-- MULTIPLE ASSIGNEES
-- Primary assignee stays on tasks.assignee_id for backward
-- compat; this table adds extra assignees.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by   UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees (user_id);

-- ============================================================
-- USER PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  language      TEXT NOT NULL DEFAULT 'en',
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  date_format   TEXT NOT NULL DEFAULT 'MMM D, YYYY',
  time_format   TEXT NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h','24h')),
  first_day_of_week  INTEGER NOT NULL DEFAULT 0 CHECK (first_day_of_week BETWEEN 0 AND 6),
  sidebar_collapsed  BOOLEAN NOT NULL DEFAULT FALSE,
  density       TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('compact','comfortable','spacious')),
  extra         JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKSPACE CLICKAPPS (feature flag toggles per workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_clickapps (
  workspace_id          UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  sprints_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  time_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priorities_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  tags_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  custom_fields_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  automations_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  goals_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  milestones_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  mind_maps_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  whiteboards_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  portfolios_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FAVORITES (bookmarks — tasks, docs, lists, spaces, etc.)
-- ============================================================

CREATE TYPE favorite_item_type AS ENUM (
  'task', 'doc', 'list', 'space', 'folder', 'dashboard', 'view', 'goal'
);

CREATE TABLE IF NOT EXISTS favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_type     favorite_item_type NOT NULL,
  item_id       UUID NOT NULL,
  item_name     TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id, position);

-- ============================================================
-- RECENTLY VIEWED
-- ============================================================

CREATE TABLE IF NOT EXISTS recently_viewed (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_type     favorite_item_type NOT NULL,
  item_id       UUID NOT NULL,
  item_name     TEXT NOT NULL,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON recently_viewed (user_id, workspace_id, viewed_at DESC);

-- ============================================================
-- COMMENT ASSIGNMENTS (assign a comment to a user as action)
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_assignments (
  comment_id    UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  assignee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by   UUID NOT NULL REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_assignments_assignee ON comment_assignments (assignee_id, resolved_at);

-- ============================================================
-- TASK PUBLIC LINKS (shareable task URLs)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_public_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_public_links_token ON task_public_links (token) WHERE is_active = TRUE;

-- ============================================================
-- PINNED TASKS (per list, per user)
-- ============================================================

CREATE TABLE IF NOT EXISTS pinned_tasks (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  list_id       UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  pinned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_tasks_list ON pinned_tasks (user_id, list_id, pinned_at DESC);

-- ============================================================
-- WORKSPACE MEMBER INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','guest')),
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  invited_by    UUID NOT NULL REFERENCES users(id),
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites (token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites (workspace_id, created_at DESC);

-- ============================================================
-- TASK TYPE (custom task types per workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  icon          TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_types_workspace ON task_types (workspace_id, position);

-- Add task_type_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES task_types(id) ON DELETE SET NULL;

-- ============================================================
-- GUEST ACCESS TOKENS (temporary workspace guest links)
-- ============================================================

CREATE TABLE IF NOT EXISTS guest_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  role          TEXT NOT NULL DEFAULT 'guest',
  max_uses      INTEGER,
  use_count     INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_links_token ON guest_links (token);

-- ============================================================
-- GOAL FOLDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS goal_folders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_goal_folders_workspace ON goal_folders (workspace_id, position);

-- Add optional folder_id to goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES goal_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_goals_folder ON goals (folder_id) WHERE folder_id IS NOT NULL;
