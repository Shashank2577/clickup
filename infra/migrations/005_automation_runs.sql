-- Migration: automation_runs table for execution history
CREATE TABLE automation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger_event   TEXT NOT NULL,              -- e.g. 'task.created'
  trigger_payload JSONB NOT NULL,             -- full event payload that triggered this run
  conditions_met  BOOLEAN NOT NULL,           -- true = conditions passed; false = skipped
  actions_taken   JSONB NOT NULL DEFAULT '[]', -- array of { type, config, success, error? }
  error           TEXT,                       -- NULL on success; error message on failure
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_automation_runs_automation
  ON automation_runs (automation_id, started_at DESC);

CREATE INDEX idx_automation_runs_workspace
  ON automation_runs (workspace_id, started_at DESC);
