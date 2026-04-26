-- ============================================================
-- Migration 002: Research-driven improvements
-- Sources: Plane, Huly, Focalboard open source analysis
-- Run after: 001_initial.sql
-- ============================================================

-- ============================================================
-- 1. TASK SEQUENCES — Human-readable task IDs (Plane pattern)
-- Display format: "{list-slug}-{seq_id}" e.g. "BACKEND-42"
-- Sequence persists even after task deletion (IDs never reused)
-- ============================================================

CREATE TABLE task_sequences (
  list_id   UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  seq_id    INTEGER NOT NULL,
  task_id   UUID,  -- NULL when task is soft-deleted (ID reserved forever)
  PRIMARY KEY (list_id, seq_id)
);

CREATE INDEX idx_task_sequences_task ON task_sequences (task_id) WHERE task_id IS NOT NULL;

-- Add seq_id column to tasks
ALTER TABLE tasks ADD COLUMN seq_id INTEGER;
CREATE INDEX idx_tasks_seq ON tasks (list_id, seq_id) WHERE deleted_at IS NULL;

-- ============================================================
-- 2. TASK STATUSES — Per-list custom statuses (Plane pattern)
-- Status group is the semantic meaning; name is display-only
-- Default statuses are seeded per list on list creation
-- ============================================================

CREATE TYPE status_group AS ENUM (
  'backlog', 'unstarted', 'started', 'completed', 'cancelled'
);

CREATE TABLE task_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  color       TEXT NOT NULL DEFAULT '#6366f1'
              CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  status_group status_group NOT NULL DEFAULT 'unstarted',
  position    DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_statuses_list ON task_statuses (list_id, position);
-- Enforce only one default per list
CREATE UNIQUE INDEX idx_task_statuses_default
  ON task_statuses (list_id)
  WHERE is_default = TRUE;

-- Migrate tasks.status (TEXT) — it stays as TEXT for now.
-- task-service resolves status name via task_statuses table.
-- Full FK migration happens after data backfill in Wave 3.

-- ============================================================
-- 3. TASK VERSION — Optimistic locking + event ordering (Huly pattern)
-- Incremented atomically on every task mutation.
-- Clients track lastSeenVersion for reconnect replay.
-- ============================================================

ALTER TABLE tasks ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- ============================================================
-- 4. TASK DESCRIPTION — Split into JSON + searchable text (Plane pattern)
-- description_json: Prosemirror/TipTap document (structured)
-- description_text: plain text for full-text search
-- Old `description TEXT` column is replaced.
-- ============================================================

ALTER TABLE tasks ADD COLUMN description_json JSONB;
ALTER TABLE tasks ADD COLUMN description_text TEXT;

-- Generated tsvector column for full-text search
ALTER TABLE tasks ADD COLUMN description_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description_text, ''))
  ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN (description_search)
  WHERE deleted_at IS NULL;

-- Backfill: copy existing description text to new column
UPDATE tasks SET description_text = description WHERE description IS NOT NULL;

-- Keep old description column for backward compat during transition
-- DROP COLUMN description; -- run this in migration 003 after backfill confirmed

-- ============================================================
-- 5. VIEWS TABLE — Multi-view support with JSONB config (Focalboard pattern)
-- list_id IS NULL = workspace-level view (cross-project)
-- config stores: filters, sorts, grouping, column widths, visibility
-- ============================================================

CREATE TYPE view_type AS ENUM (
  'list', 'board', 'calendar', 'timeline', 'table', 'workload', 'gantt'
);

CREATE TABLE views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         UUID REFERENCES lists(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  type            view_type NOT NULL DEFAULT 'list',
  config          JSONB NOT NULL DEFAULT '{}',
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_views_list ON views (list_id)
  WHERE list_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_views_workspace ON views (workspace_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_views_config ON views USING GIN (config);

CREATE TRIGGER trg_views_updated_at
  BEFORE UPDATE ON views FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. VIEW TASK ORDER — Per-view card ordering (Focalboard lesson)
-- Avoids the JSON array size limit hit at 10k+ tasks.
-- Only populated when user drags to explicitly reorder in a view.
-- Falls back to tasks.position when no override exists.
-- ============================================================

CREATE TABLE view_task_order (
  view_id     UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position    DOUBLE PRECISION NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (view_id, task_id)
);

CREATE INDEX idx_view_task_order_view ON view_task_order (view_id, position);

-- ============================================================
-- 7. VIEW USER STATE — Per-user view preferences (Plane + Focalboard pattern)
-- Shared views can have per-user overrides for collapsed groups, hidden columns.
-- Never stored on the main views table (which is the shared canonical state).
-- ============================================================

CREATE TABLE view_user_state (
  view_id          UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collapsed_groups TEXT[]  NOT NULL DEFAULT '{}',
  hidden_columns   TEXT[]  NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (view_id, user_id)
);

-- ============================================================
-- 8. RATE LIMIT TRACKING — Per-user mutation rate (Huly lesson)
-- Used by api-gateway to enforce 250 mutations / 30 seconds.
-- In practice this is tracked in Redis, not Postgres.
-- This table is for audit + analytics only.
-- ============================================================

CREATE TABLE rate_limit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  hit_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_events_user ON rate_limit_events (user_id, hit_at DESC);

-- ============================================================
-- SUMMARY of additions:
-- + task_sequences    (human-readable IDs, Plane)
-- + task_statuses     (per-list custom statuses, Plane)
-- + tasks.version     (optimistic locking, Huly)
-- + tasks.description_json / description_text / description_search (Plane)
-- + views             (JSONB view config, Focalboard)
-- + view_task_order   (explicit ordering, Focalboard)
-- + view_user_state   (per-user overrides, Plane + Focalboard)
-- + rate_limit_events (audit log, Huly)
-- ============================================================
