function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
export function buildServiceRoutes() {
    const IDENTITY = requireEnv('IDENTITY_SERVICE_URL');
    const TASK = requireEnv('TASK_SERVICE_URL');
    const GOAL = requireEnv('GOAL_SERVICE_URL');
    // Identity service routes share pathStripPrefix: '/api/v1' so the upstream
    // receives paths like /auth/..., /users/..., /workspaces/..., /spaces/..., /lists/...
    // matching identity-service's router.use('/auth', ...) etc.
    return [
        // ── Identity service — auth, users, workspaces, spaces, lists, invites ──────
        // Order matters: more specific prefixes must come before shorter ones
        { prefix: '/api/v1/auth', target: IDENTITY, isMutation: true, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/users', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/workspaces', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/spaces', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/lists', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/folders', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        // Wave 4: invites accept endpoint + command palette
        { prefix: '/api/v1/invites', target: IDENTITY, isMutation: true, pathStripPrefix: '/api/v1' },
        { prefix: '/api/v1/command-palette', target: IDENTITY, isMutation: false, pathStripPrefix: '/api/v1' },
        // ── Task service ─────────────────────────────────────────────────────────────
        // Core task CRUD — strips /api/v1/tasks, upstream receives /:taskId etc.
        { prefix: '/api/v1/tasks', target: TASK, isMutation: false },
        // Custom field definitions — workspace-scoped (strips /api/v1/custom-fields)
        { prefix: '/api/v1/custom-fields', target: TASK, isMutation: false },
        // Per-list statuses — pathStripPrefix '/api/v1' → upstream sees /list-statuses/:listId
        { prefix: '/api/v1/list-statuses', target: TASK, isMutation: false, pathStripPrefix: '/api/v1' },
        // Task templates — upstream sees /task-templates/:workspaceId
        { prefix: '/api/v1/task-templates', target: TASK, isMutation: false, pathStripPrefix: '/api/v1' },
        // List-scoped form creation — upstream sees /task-forms/:listId
        { prefix: '/api/v1/task-forms', target: TASK, isMutation: false, pathStripPrefix: '/api/v1' },
        // Public form submission + form management — upstream sees /forms/...
        { prefix: '/api/v1/forms', target: TASK, isMutation: true, pathStripPrefix: '/api/v1' },
        // Task types (custom task types per workspace) — upstream sees /task-types/...
        { prefix: '/api/v1/task-types', target: TASK, isMutation: false, pathStripPrefix: '/api/v1' },
        // ── Comment service ───────────────────────────────────────────────────────────
        { prefix: '/api/v1/comments', target: requireEnv('COMMENT_SERVICE_URL'), isMutation: false },
        // Notification service
        { prefix: '/api/v1/notifications', target: requireEnv('NOTIFICATION_SERVICE_URL'), isMutation: false },
        // AI service
        { prefix: '/api/v1/ai', target: requireEnv('AI_SERVICE_URL'), isMutation: true },
        // File service
        { prefix: '/api/v1/files', target: requireEnv('FILE_SERVICE_URL'), isMutation: true },
        // Search service
        { prefix: '/api/v1/search', target: requireEnv('SEARCH_SERVICE_URL'), isMutation: false },
        // Docs service
        { prefix: '/api/v1/docs', target: requireEnv('DOCS_SERVICE_URL'), isMutation: false },
        // Automations service
        { prefix: '/api/v1/automations', target: requireEnv('AUTOMATIONS_SERVICE_URL'), isMutation: true },
        // Goals service (goal CRUD + goal-folders handled internally)
        { prefix: '/api/v1/goals', target: GOAL, isMutation: false },
        // Views service
        { prefix: '/api/v1/views', target: requireEnv('VIEWS_SERVICE_URL'), isMutation: false },
        // Webhooks service
        { prefix: '/api/v1/webhooks', target: requireEnv('WEBHOOKS_SERVICE_URL'), isMutation: false },
        // Dashboard service
        { prefix: '/api/v1/dashboards', target: requireEnv('DASHBOARD_SERVICE_URL'), isMutation: false },
        // Sprint service
        { prefix: '/api/v1/sprints', target: requireEnv('SPRINT_SERVICE_URL'), isMutation: false },
    ];
}
//# sourceMappingURL=proxy.config.js.map