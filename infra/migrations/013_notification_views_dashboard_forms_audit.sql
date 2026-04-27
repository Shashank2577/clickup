-- ============================================================
-- MIGRATION 013 — Notification enhancements, View sharing,
-- Dashboard templates, Form service, Audit service
-- ============================================================

-- ============================================================
-- NOTIFICATION ENHANCEMENTS
-- ============================================================

-- Add category column (primary/other) for inbox filtering
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'primary'
  CHECK (category IN ('primary', 'other'));

-- Add snooze support
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- Add cleared support (soft-archive)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_snoozed
  ON notifications (user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL AND is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_cleared
  ON notifications (user_id, cleared_at DESC)
  WHERE is_cleared = TRUE;

CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON notifications (user_id, category, created_at DESC)
  WHERE is_read = FALSE AND is_cleared = FALSE;

-- ============================================================
-- REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  remind_at     TIMESTAMPTZ NOT NULL,
  entity_type   TEXT,          -- 'task', 'doc', 'comment', etc.
  entity_id     UUID,          -- FK to the referenced entity
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user
  ON reminders (user_id, remind_at ASC)
  WHERE is_completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_reminders_entity
  ON reminders (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================================================
-- VIEW SHARING
-- ============================================================

ALTER TABLE views ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'shared'));
ALTER TABLE views ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_views_pinned
  ON views (pinned DESC)
  WHERE pinned = TRUE;

-- ============================================================
-- DASHBOARD TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'general',
  widgets       JSONB NOT NULL DEFAULT '[]',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add optional template reference and scheduled report config to dashboards
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES dashboard_templates(id) ON DELETE SET NULL;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS report_schedule JSONB;

-- ============================================================
-- FORM SERVICE TABLES
-- ============================================================

-- Add phone, rating, file_upload to the form fields
-- The task_forms table already exists (migration 008), but we need
-- a dedicated forms table for the form-service with richer schema

CREATE TABLE IF NOT EXISTS forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  list_id       UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  fields        JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_workspace ON forms (workspace_id);
CREATE INDEX IF NOT EXISTS idx_forms_list ON forms (list_id);

CREATE TABLE IF NOT EXISTS form_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  submitted_by  TEXT,           -- email or name of submitter (may be anonymous)
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_responses_form ON form_responses (form_id, submitted_at DESC);

-- ============================================================
-- AUDIT SERVICE TABLE (workspace-scoped audit log)
-- NOTE: audit_logs table already exists from migration 008.
-- We add a couple of extra columns if missing.
-- ============================================================

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ============================================================
-- SEED DASHBOARD TEMPLATES
-- ============================================================

INSERT INTO dashboard_templates (name, description, category, widgets, is_default)
VALUES
  (
    'Simple',
    'A simple overview dashboard with task counts and status breakdown',
    'general',
    '[
      {"type":"task_count","title":"Total Tasks","positionX":0,"positionY":0,"width":3,"height":2,"config":{}},
      {"type":"task_by_status","title":"Tasks by Status","positionX":3,"positionY":0,"width":5,"height":3,"config":{}},
      {"type":"overdue_tasks","title":"Overdue Tasks","positionX":8,"positionY":0,"width":4,"height":2,"config":{}},
      {"type":"completion_rate","title":"Completion Rate","positionX":0,"positionY":3,"width":4,"height":3,"config":{}}
    ]'::jsonb,
    TRUE
  ),
  (
    'Time Tracking',
    'Dashboard focused on time tracking and billable hours',
    'time_tracking',
    '[
      {"type":"time_tracked","title":"Total Time Tracked","positionX":0,"positionY":0,"width":4,"height":2,"config":{}},
      {"type":"billable_time","title":"Billable Time","positionX":4,"positionY":0,"width":4,"height":2,"config":{}},
      {"type":"time_by_user","title":"Time by Team Member","positionX":0,"positionY":2,"width":6,"height":4,"config":{}},
      {"type":"task_by_assignee","title":"Tasks by Assignee","positionX":6,"positionY":2,"width":6,"height":4,"config":{}}
    ]'::jsonb,
    TRUE
  ),
  (
    'Project Management',
    'Full project management dashboard with velocity and burndown',
    'project_management',
    '[
      {"type":"task_by_status","title":"Tasks by Status","positionX":0,"positionY":0,"width":6,"height":3,"config":{}},
      {"type":"task_by_priority","title":"Tasks by Priority","positionX":6,"positionY":0,"width":6,"height":3,"config":{}},
      {"type":"velocity","title":"Sprint Velocity","positionX":0,"positionY":3,"width":6,"height":4,"config":{}},
      {"type":"burndown","title":"Burndown Chart","positionX":6,"positionY":3,"width":6,"height":4,"config":{}},
      {"type":"completion_rate","title":"Completion Rate","positionX":0,"positionY":7,"width":4,"height":3,"config":{}},
      {"type":"recent_activity","title":"Recent Activity","positionX":4,"positionY":7,"width":8,"height":3,"config":{}}
    ]'::jsonb,
    TRUE
  )
ON CONFLICT (name) DO NOTHING;
