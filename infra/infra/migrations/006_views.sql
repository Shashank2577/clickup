-- ============================================================
-- Migration 006: Views and view user state
-- ============================================================

CREATE TABLE IF NOT EXISTS views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id      UUID REFERENCES lists(id) ON DELETE CASCADE,  -- null = workspace-wide view
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'list',  -- list|board|calendar|table|timeline
  config       JSONB NOT NULL DEFAULT '{}',
  created_by   UUID NOT NULL REFERENCES users(id),
  is_private   BOOLEAN NOT NULL DEFAULT false,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_list ON views(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_views_workspace ON views(workspace_id);

CREATE TABLE IF NOT EXISTS view_user_state (
  view_id          UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collapsed_groups TEXT[] NOT NULL DEFAULT '{}',
  hidden_columns   TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (view_id, user_id)
);
