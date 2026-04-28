export interface ServiceRoute {
  prefix: string
  target: string
  isMutation: boolean
  /**
   * The prefix stripped from req.originalUrl before forwarding to the upstream.
   * Defaults to `prefix` when not set (strips the full route prefix).
   * Set to '/api/v1' for services whose upstream uses /resource sub-routing
   * (e.g. identity-service which handles /auth/*, /users/*, /workspaces/*).
   */
  pathStripPrefix?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function buildServiceRoutes(): ServiceRoute[] {
  const IDENTITY = requireEnv('IDENTITY_SERVICE_URL')
  const TASK     = requireEnv('TASK_SERVICE_URL')
  const GOAL     = requireEnv('GOAL_SERVICE_URL')
  const CHAT     = requireEnv('CHAT_SERVICE_URL')
  const AUDIT    = requireEnv('AUDIT_SERVICE_URL')
  // Identity service routes share pathStripPrefix: '/api/v1' so the upstream
  // receives paths like /auth/..., /users/..., /workspaces/..., /spaces/..., /lists/...
  // matching identity-service's router.use('/auth', ...) etc.
  return [
    // ── Identity service — auth, users, workspaces, spaces, lists, invites ──────
    // Nginx strips /api/ before forwarding, so gateway sees /v1/... paths.
    // Order matters: more specific prefixes must come before shorter ones
    { prefix: '/v1/auth',             target: IDENTITY, isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/users',            target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/workspaces',       target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/spaces',           target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/lists',            target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/folders',          target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/invites',          target: IDENTITY, isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/command-palette',  target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/favorites',        target: IDENTITY, isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/teams',            target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/trash',            target: IDENTITY, isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/sidebar',          target: IDENTITY, isMutation: false, pathStripPrefix: '/v1' },

    // ── Task service ─────────────────────────────────────────────────────────────
    { prefix: '/v1/tasks',            target: TASK, isMutation: false },
    { prefix: '/v1/custom-fields',    target: TASK, isMutation: false },
    { prefix: '/v1/list-statuses',    target: TASK, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/task-templates',   target: TASK, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/task-forms',       target: TASK, isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/forms',            target: TASK, isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/task-types',       target: TASK, isMutation: false, pathStripPrefix: '/v1' },

    // ── Chat service — channels, DMs, messages ─────────────────────────────────
    { prefix: '/v1/channels',         target: CHAT,     isMutation: false, pathStripPrefix: '/v1' },
    { prefix: '/v1/dm',               target: CHAT,     isMutation: true,  pathStripPrefix: '/v1' },
    { prefix: '/v1/messages',         target: CHAT,     isMutation: false, pathStripPrefix: '/v1' },

    // ── Audit service ────────────────────────────────────────────────────────────
    { prefix: '/v1/audit-logs',       target: AUDIT,    isMutation: false },

    // ── Comment service ───────────────────────────────────────────────────────────
    { prefix: '/v1/comments',         target: requireEnv('COMMENT_SERVICE_URL'),       isMutation: false },
    { prefix: '/v1/notifications',    target: requireEnv('NOTIFICATION_SERVICE_URL'),  isMutation: false },
    { prefix: '/v1/ai',               target: requireEnv('AI_SERVICE_URL'),            isMutation: true  },
    { prefix: '/v1/files',            target: requireEnv('FILE_SERVICE_URL'),          isMutation: true  },
    { prefix: '/v1/search',           target: requireEnv('SEARCH_SERVICE_URL'),        isMutation: false },
    { prefix: '/v1/docs',             target: requireEnv('DOCS_SERVICE_URL'),          isMutation: false },
    { prefix: '/v1/automations',      target: requireEnv('AUTOMATIONS_SERVICE_URL'),   isMutation: true  },
    { prefix: '/v1/goals',            target: GOAL, isMutation: false },
    { prefix: '/v1/views',            target: requireEnv('VIEWS_SERVICE_URL'),         isMutation: false },
    { prefix: '/v1/webhooks',         target: requireEnv('WEBHOOKS_SERVICE_URL'),      isMutation: false },
    { prefix: '/v1/dashboards',       target: requireEnv('DASHBOARD_SERVICE_URL'),     isMutation: false },
    { prefix: '/v1/sprints',          target: requireEnv('SPRINT_SERVICE_URL'),        isMutation: false },
    { prefix: '/v1/slack',            target: requireEnv('SLACK_SERVICE_URL'),         isMutation: true  },
    { prefix: '/v1/github',           target: requireEnv('GITHUB_SERVICE_URL'),        isMutation: true  },
    { prefix: '/v1/gitlab',           target: requireEnv('GITLAB_SERVICE_URL'),        isMutation: true  },
  ]
}
