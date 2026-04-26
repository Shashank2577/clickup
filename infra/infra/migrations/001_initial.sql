-- ============================================================
-- ClickUp OSS — Initial Schema
-- Version: 001
-- All IDs: UUID v4
-- All timestamps: TIMESTAMPTZ (UTC)
-- Soft deletes: deleted_at IS NULL for active records
-- Materialized path: format /{list_id}/{task_id}/
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'guest');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'normal', 'low', 'none');
CREATE TYPE task_relation_type AS ENUM ('blocks', 'blocked_by', 'relates_to', 'duplicate_of');
CREATE TYPE custom_field_type AS ENUM (
  'text', 'number', 'dropdown', 'labels', 'date',
  'checkbox', 'url', 'email', 'phone', 'currency',
  'formula', 'rating', 'relationship', 'rollup'
);
CREATE TYPE goal_target_type AS ENUM ('number', 'currency', 'boolean', 'task');
CREATE TYPE notification_type AS ENUM (
  'task_assigned', 'task_commented', 'task_mentioned',
  'task_due_soon', 'task_overdue', 'task_completed',
  'goal_progress', 'workspace_invite'
);
CREATE TYPE automation_trigger_type AS ENUM (
  'task_created', 'task_status_changed', 'task_assigned',
  'task_due_date_reached', 'task_field_changed', 'comment_created'
);
CREATE TYPE automation_action_type AS ENUM (
  'assign_user', 'change_status', 'update_field',
  'add_comment', 'send_notification', 'webhook', 'create_task'
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- ============================================================
-- SESSIONS
-- ============================================================

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- ============================================================
-- WORKSPACES
-- ============================================================

CREATE TABLE workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  owner_id      UUID NOT NULL REFERENCES users(id),
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_workspaces_slug ON workspaces (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_workspaces_owner ON workspaces (owner_id) WHERE deleted_at IS NULL;

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================

CREATE TABLE workspace_members (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'member',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members (user_id);

-- ============================================================
-- SPACES
-- ============================================================

CREATE TABLE spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  icon          TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_spaces_workspace ON spaces (workspace_id, position) WHERE deleted_at IS NULL;

-- ============================================================
-- LISTS
-- ============================================================

CREATE TABLE lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_lists_space ON lists (space_id, position) WHERE deleted_at IS NULL;

-- ============================================================
-- TASKS
-- Materialized path format: /{list_id}/{task_id}/
-- Root tasks: /{list_id}/{task_id}/
-- Subtasks:   /{list_id}/{parent_id}/{task_id}/
-- ============================================================

CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id           UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  parent_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  path              TEXT NOT NULL,
  title             TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 500),
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'todo',
  priority          task_priority NOT NULL DEFAULT 'none',
  assignee_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date          TIMESTAMPTZ,
  start_date        TIMESTAMPTZ,
  estimated_minutes INTEGER CHECK (estimated_minutes > 0),
  actual_minutes    INTEGER CHECK (actual_minutes >= 0),
  sprint_points     INTEGER CHECK (sprint_points >= 0),
  position          FLOAT NOT NULL DEFAULT 0,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ
);

-- Core lookup indexes
CREATE INDEX idx_tasks_list ON tasks (list_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_parent ON tasks (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON tasks (assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks (due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX idx_tasks_status ON tasks (list_id, status) WHERE deleted_at IS NULL;

-- Materialized path index — critical for subtree queries
CREATE INDEX idx_tasks_path ON tasks USING BTREE (path text_pattern_ops) WHERE deleted_at IS NULL;

-- ============================================================
-- TASK WATCHERS
-- ============================================================

CREATE TABLE task_watchers (
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_watchers_user ON task_watchers (user_id);

-- ============================================================
-- TASK TAGS
-- ============================================================

CREATE TABLE task_tags (
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL CHECK (length(tag) >= 1 AND length(tag) <= 50),
  PRIMARY KEY (task_id, tag)
);

CREATE INDEX idx_task_tags_tag ON task_tags (tag);

-- ============================================================
-- TASK RELATIONS
-- ============================================================

CREATE TABLE task_relations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  related_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type            task_relation_type NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, related_task_id, type),
  CHECK (task_id != related_task_id)
);

CREATE INDEX idx_task_relations_task ON task_relations (task_id);
CREATE INDEX idx_task_relations_related ON task_relations (related_task_id);

-- ============================================================
-- CHECKLISTS
-- ============================================================

CREATE TABLE checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Checklist',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklists_task ON checklists (task_id, position);

CREATE TABLE checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date      TIMESTAMPTZ,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id, position);

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  content       TEXT NOT NULL CHECK (length(content) >= 1),
  parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_comments_task ON comments (task_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent ON comments (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user ON comments (user_id) WHERE deleted_at IS NULL;

CREATE TABLE comment_reactions (
  comment_id    UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL CHECK (length(emoji) >= 1 AND length(emoji) <= 10),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

-- ============================================================
-- DOCS
-- Materialized path mirrors task path pattern
-- ============================================================

CREATE TABLE docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled',
  content       JSONB NOT NULL DEFAULT '{}',
  parent_id     UUID REFERENCES docs(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_docs_workspace ON docs (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_path ON docs USING BTREE (path text_pattern_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_parent ON docs (parent_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CUSTOM FIELDS
-- ============================================================

CREATE TABLE custom_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          custom_field_type NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_fields_workspace ON custom_fields (workspace_id);

CREATE TABLE task_custom_fields (
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id      UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, field_id)
);

-- ============================================================
-- GOALS & OKRs
-- ============================================================

CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  owner_id      UUID NOT NULL REFERENCES users(id),
  color         TEXT NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_goals_workspace ON goals (workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE goal_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            goal_target_type NOT NULL,
  target_value    NUMERIC,
  current_value   NUMERIC NOT NULL DEFAULT 0,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_targets_goal ON goal_targets (goal_id);

-- ============================================================
-- TIME TRACKING
-- ============================================================

CREATE TABLE time_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  minutes       INTEGER NOT NULL CHECK (minutes > 0),
  billable      BOOLEAN NOT NULL DEFAULT FALSE,
  note          TEXT,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at > started_at)
);

CREATE INDEX idx_time_entries_task ON time_entries (task_id);
CREATE INDEX idx_time_entries_user ON time_entries (user_id, started_at);

-- ============================================================
-- FILES
-- ============================================================

CREATE TABLE files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL CHECK (size_bytes > 0),
  mime_type     TEXT NOT NULL,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_task ON files (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_files_workspace ON files (workspace_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          notification_type NOT NULL,
  payload       JSONB NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

-- ============================================================
-- AUTOMATIONS
-- ============================================================

CREATE TABLE automations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  trigger_type  automation_trigger_type NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions    JSONB NOT NULL DEFAULT '[]',
  actions       JSONB NOT NULL DEFAULT '[]',
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  run_count     INTEGER NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automations_workspace ON automations (workspace_id) WHERE is_enabled = TRUE;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lists_updated_at
  BEFORE UPDATE ON lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_docs_updated_at
  BEFORE UPDATE ON docs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_automations_updated_at
  BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_checklist_items_updated_at
  BEFORE UPDATE ON checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
