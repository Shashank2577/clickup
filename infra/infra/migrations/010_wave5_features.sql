-- ============================================================
-- MIGRATION 010 — Wave 5: OAuth, 2FA, Multi-home, Templates,
--                         Push, Slack/GitHub integrations, SSO
-- ============================================================

-- ============================================================
-- OAUTH ACCOUNTS (social login)
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,            -- 'google' | 'github'
  provider_user_id  TEXT NOT NULL,
  access_token      TEXT,
  refresh_token     TEXT,
  provider_email    TEXT,
  provider_name     TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts (user_id);

-- ============================================================
-- TOTP SECRETS (2FA)
-- ============================================================

CREATE TABLE IF NOT EXISTS totp_secrets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret      TEXT NOT NULL,          -- base32-encoded TOTP secret
  verified    BOOLEAN NOT NULL DEFAULT false,
  backup_codes TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track which sessions have been 2FA-verified
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS totp_verified BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- SAML / SSO CONFIGS
-- ============================================================

CREATE TABLE IF NOT EXISTS saml_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  idp_entity_id     TEXT NOT NULL,
  idp_sso_url       TEXT NOT NULL,
  idp_certificate   TEXT NOT NULL,   -- PEM-encoded X.509 cert
  sp_entity_id      TEXT NOT NULL,   -- our service-provider entity ID
  attribute_mapping JSONB NOT NULL DEFAULT '{"email":"email","firstName":"firstName","lastName":"lastName"}',
  enabled           BOOLEAN NOT NULL DEFAULT false,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOC TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = global/public template
  created_by   UUID NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  description  TEXT,
  content      JSONB NOT NULL DEFAULT '{}',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  is_public    BOOLEAN NOT NULL DEFAULT false,
  use_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_workspace ON doc_templates (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_templates_public ON doc_templates (is_public) WHERE is_public = true;

-- ============================================================
-- TASK MIRRORS (multi-home tasks)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_mirrors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  mirrored_list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (original_task_id, mirrored_list_id)
);

CREATE INDEX IF NOT EXISTS idx_task_mirrors_original ON task_mirrors (original_task_id);
CREATE INDEX IF NOT EXISTS idx_task_mirrors_list ON task_mirrors (mirrored_list_id, position);

-- ============================================================
-- PUSH SUBSCRIPTIONS (web push notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,   -- ECDH public key
  auth       TEXT NOT NULL,   -- auth secret
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

-- ============================================================
-- GOAL PERMISSIONS (goal sharing)
-- ============================================================

CREATE TABLE IF NOT EXISTS goal_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- 'viewer' | 'editor' | 'owner'
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_permissions_goal ON goal_permissions (goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_permissions_user ON goal_permissions (user_id);

-- Mark goals as private/shared
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- AUTOMATION SCHEDULES (time-based triggers)
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  cron_expr      TEXT NOT NULL,     -- standard 5-field cron: '0 9 * * 1'
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  last_run_at    TIMESTAMPTZ,
  next_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_schedules_next ON automation_schedules (next_run_at)
  WHERE next_run_at IS NOT NULL;

-- ============================================================
-- SLACK INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS slack_installations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  slack_team_id    TEXT NOT NULL UNIQUE,
  slack_team_name  TEXT,
  bot_user_id      TEXT,
  bot_access_token TEXT NOT NULL,
  installed_by     UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slack_channel_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  list_id          UUID REFERENCES lists(id) ON DELETE SET NULL,
  slack_team_id    TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL,
  slack_channel_name TEXT,
  events           TEXT[] NOT NULL DEFAULT '{"task_created","task_completed","comment_created"}',
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, slack_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_channel_links_workspace ON slack_channel_links (workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channel_links_list ON slack_channel_links (list_id) WHERE list_id IS NOT NULL;

-- ============================================================
-- GITHUB INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS github_installations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  github_installation_id  BIGINT NOT NULL UNIQUE,
  github_account_login    TEXT,
  github_account_type     TEXT,   -- 'User' | 'Organization'
  access_token            TEXT,
  installed_by            UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_pr_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_full_name  TEXT NOT NULL,   -- 'owner/repo'
  pr_number       INTEGER NOT NULL,
  pr_title        TEXT,
  pr_state        TEXT,            -- 'open' | 'closed' | 'merged'
  pr_url          TEXT,
  sha             TEXT,            -- latest commit SHA
  linked_by       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, repo_full_name, pr_number)
);

CREATE INDEX IF NOT EXISTS idx_github_pr_links_task ON github_pr_links (task_id);
CREATE INDEX IF NOT EXISTS idx_github_pr_links_workspace ON github_pr_links (workspace_id);

-- Repo subscriptions (which repos to listen to for a workspace)
CREATE TABLE IF NOT EXISTS github_repo_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_full_name  TEXT NOT NULL,
  webhook_id      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, repo_full_name)
);
