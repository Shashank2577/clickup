-- ============================================================
-- MIGRATION 008 — Wave 3 Features
-- Sprints, Dashboards, Folders, List Statuses, Task Templates,
-- Public Forms, Task Activity Log, Audit Log, Doc Permissions,
-- Doc Versions, Recurring Tasks, Password Reset, Email Verify
-- ============================================================

-- ============================================================
-- FOLDERS (Space → Folder → List hierarchy)
-- ============================================================

CREATE TABLE IF NOT EXISTS folders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_space ON folders (space_id, position);

-- Add optional folder_id to lists
ALTER TABLE lists ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lists_folder ON lists (folder_id) WHERE folder_id IS NOT NULL;

-- ============================================================
-- PER-LIST CUSTOM STATUSES
-- ============================================================

CREATE TABLE IF NOT EXISTS list_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  position      INTEGER NOT NULL DEFAULT 0,
  is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, name)
);

CREATE INDEX IF NOT EXISTS idx_list_statuses_list ON list_statuses (list_id, position);

-- ============================================================
-- SPRINTS
-- ============================================================

CREATE TABLE IF NOT EXISTS sprints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  goal          TEXT,
  status        TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','completed')),
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  velocity      INTEGER,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprints_list ON sprints (list_id, created_at DESC);

-- Sprint ↔ Task join (tasks can be in sprints)
CREATE TABLE IF NOT EXISTS sprint_tasks (
  sprint_id     UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sprint_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task ON sprint_tasks (task_id);

-- ============================================================
-- DASHBOARDS & WIDGETS
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id      UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards (workspace_id);

CREATE TYPE dashboard_widget_type AS ENUM (
  'task_count', 'task_by_status', 'task_by_assignee', 'task_by_priority',
  'completion_rate', 'time_tracked', 'time_by_user', 'billable_time',
  'velocity', 'burndown', 'cumulative_flow', 'overdue_tasks',
  'recent_activity', 'goals_progress', 'custom_text', 'embed'
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type          dashboard_widget_type NOT NULL,
  title         TEXT NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  position_x    INTEGER NOT NULL DEFAULT 0,
  position_y    INTEGER NOT NULL DEFAULT 0,
  width         INTEGER NOT NULL DEFAULT 4,
  height        INTEGER NOT NULL DEFAULT 3,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets (dashboard_id);

-- ============================================================
-- TASK ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS task_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  field         TEXT,
  old_value     JSONB,
  new_value     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON task_activity (user_id, created_at DESC);

-- ============================================================
-- TASK TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS task_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_workspace ON task_templates (workspace_id);

-- ============================================================
-- PUBLIC FORMS (intake forms → task creation)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  fields        JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  slug          TEXT NOT NULL UNIQUE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_forms_list ON task_forms (list_id);
CREATE INDEX IF NOT EXISTS idx_task_forms_slug ON task_forms (slug);

CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES task_forms(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions (form_id, submitted_at DESC);

-- ============================================================
-- RECURRING TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_task_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
  cron_expr     TEXT NOT NULL,
  next_run_at   TIMESTAMPTZ,
  last_run_at   TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_configs_next ON recurring_task_configs (next_run_at) WHERE is_active = TRUE;

-- ============================================================
-- WORKSPACE AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  action        TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

-- ============================================================
-- DOC PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('viewer','commenter','editor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_permissions_doc ON doc_permissions (doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_permissions_user ON doc_permissions (user_id);

CREATE TABLE IF NOT EXISTS doc_share_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE UNIQUE,
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','commenter')),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOC VERSION HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  content       JSONB NOT NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON doc_versions (doc_id, created_at DESC);

-- ============================================================
-- PASSWORD RESET + EMAIL VERIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens (token) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens (token) WHERE verified_at IS NULL;

-- Add email_verified column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  types           JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, workspace_id)
);

-- ============================================================
-- COMMENT THREADS (replies)
-- ============================================================

-- The comments table already has parent_id — just ensure index exists
CREATE INDEX IF NOT EXISTS idx_comments_parent_thread ON comments (parent_id, created_at ASC) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- API KEYS
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);

-- ============================================================
-- SAVED SEARCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  query         TEXT NOT NULL,
  filters       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches (user_id, workspace_id);
