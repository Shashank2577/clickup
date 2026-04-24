-- ============================================================
-- MIGRATION 011 — Wave 5b: Gap closure
-- Adds: missing field types, view types, burnup widget,
--       task permissions, field permissions, automation/list/
--       folder/space templates, form conditions, doc comments
-- ============================================================

-- ── Enum extensions ──────────────────────────────────────────
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'location';
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'voting';

ALTER TYPE view_type ADD VALUE IF NOT EXISTS 'activity';
ALTER TYPE view_type ADD VALUE IF NOT EXISTS 'box';
ALTER TYPE view_type ADD VALUE IF NOT EXISTS 'doc';
ALTER TYPE view_type ADD VALUE IF NOT EXISTS 'gantt';

ALTER TYPE dashboard_widget_type ADD VALUE IF NOT EXISTS 'burnup';

ALTER TYPE automation_trigger_type ADD VALUE IF NOT EXISTS 'sprint_started';
ALTER TYPE automation_trigger_type ADD VALUE IF NOT EXISTS 'sprint_completed';

-- ── Task permissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- 'viewer' | 'editor'
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_permissions_task ON task_permissions (task_id);

-- ── Field-level permissions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS field_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id   UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,           -- e.g. 'member', 'guest'
  can_read   BOOLEAN NOT NULL DEFAULT true,
  can_write  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_id, role)
);

-- ── Automation templates (pre-built rules) ───────────────────
CREATE TABLE IF NOT EXISTS automation_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL DEFAULT 'general',
  trigger_type   TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions     JSONB NOT NULL DEFAULT '[]',
  actions        JSONB NOT NULL DEFAULT '[]',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO automation_templates (id, name, description, category, trigger_type, trigger_config, conditions, actions)
VALUES
  (gen_random_uuid(), 'Auto-assign on creation', 'Assign a default user when a task is created', 'assignment', 'task_created', '{}', '[]', '[{"type":"assign_user","config":{"userId":"PLACEHOLDER"}}]'),
  (gen_random_uuid(), 'Move to Done on complete', 'Change status to Done when task is completed', 'status', 'task_status_changed', '{"toStatus":"completed"}', '[]', '[{"type":"change_status","config":{"status":"done"}}]'),
  (gen_random_uuid(), 'Notify on overdue', 'Send notification when task due date is reached', 'notification', 'task_due_date_reached', '{}', '[]', '[{"type":"send_notification","config":{"message":"Task is now overdue"}}]'),
  (gen_random_uuid(), 'Comment on status change', 'Add automated comment when status changes', 'tracking', 'task_status_changed', '{}', '[]', '[{"type":"add_comment","config":{"content":"Status was changed automatically"}}]'),
  (gen_random_uuid(), 'Webhook on task create', 'Fire webhook when a new task is created', 'integration', 'task_created', '{}', '[]', '[{"type":"webhook","config":{"url":"https://example.com/webhook"}}]'),
  (gen_random_uuid(), 'Sprint start notification', 'Notify team when sprint begins', 'agile', 'sprint_started', '{}', '[]', '[{"type":"send_notification","config":{"message":"Sprint has started!"}}]')
ON CONFLICT DO NOTHING;

-- ── List / Folder / Space templates ──────────────────────────
CREATE TABLE IF NOT EXISTS list_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  statuses       JSONB NOT NULL DEFAULT '[]',
  default_fields JSONB NOT NULL DEFAULT '[]',
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folder_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  list_templates  JSONB NOT NULL DEFAULT '[]',
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS space_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  folder_templates JSONB NOT NULL DEFAULT '[]',
  features         JSONB NOT NULL DEFAULT '{}',
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Form conditional logic ───────────────────────────────────
ALTER TABLE task_forms ADD COLUMN IF NOT EXISTS field_conditions JSONB NOT NULL DEFAULT '[]';

-- ── Doc comments (make task_id nullable, add doc_id) ─────────
ALTER TABLE comments ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS doc_id UUID REFERENCES docs(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comments_doc ON comments (doc_id) WHERE doc_id IS NOT NULL;
-- Either task_id or doc_id must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_comments_parent'
  ) THEN
    ALTER TABLE comments ADD CONSTRAINT chk_comments_parent
      CHECK (task_id IS NOT NULL OR doc_id IS NOT NULL);
  END IF;
END;
$$;

-- ── GitLab integration ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gitlab_installations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  gitlab_url      TEXT NOT NULL DEFAULT 'https://gitlab.com',
  access_token    TEXT NOT NULL,
  gitlab_user_id  TEXT,
  gitlab_username TEXT,
  installed_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gitlab_mr_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_path   TEXT NOT NULL,
  mr_iid         INTEGER NOT NULL,
  mr_title       TEXT,
  mr_state       TEXT,
  mr_url         TEXT,
  sha            TEXT,
  linked_by      UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, project_path, mr_iid)
);

CREATE INDEX IF NOT EXISTS idx_gitlab_mr_links_task ON gitlab_mr_links (task_id);
