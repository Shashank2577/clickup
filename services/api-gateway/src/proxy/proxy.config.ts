export interface ServiceRoute {
  prefix: string
  target: string
  isMutation: boolean
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function buildServiceRoutes(): ServiceRoute[] {
  return [
    // Identity service — auth, users, workspaces, spaces, lists
    {
      prefix: '/api/v1/auth',
      target: requireEnv('IDENTITY_SERVICE_URL'),
      isMutation: true,
    },
    {
      prefix: '/api/v1/users',
      target: requireEnv('IDENTITY_SERVICE_URL'),
      isMutation: false,
    },
    {
      prefix: '/api/v1/workspaces',
      target: requireEnv('IDENTITY_SERVICE_URL'),
      isMutation: false,
    },
    // Task service
    {
      prefix: '/api/v1/tasks',
      target: requireEnv('TASK_SERVICE_URL'),
      isMutation: false,
    },
    {
      prefix: '/api/v1/lists',
      target: requireEnv('TASK_SERVICE_URL'),
      isMutation: false,
    },
    // Comment service
    {
      prefix: '/api/v1/comments',
      target: requireEnv('COMMENT_SERVICE_URL'),
      isMutation: false,
    },
    // Notification service
    {
      prefix: '/api/v1/notifications',
      target: requireEnv('NOTIFICATION_SERVICE_URL'),
      isMutation: false,
    },
    // AI service
    {
      prefix: '/api/v1/ai',
      target: requireEnv('AI_SERVICE_URL'),
      isMutation: true,
    },
    // Search service
    {
      prefix: '/api/v1/search',
      target: requireEnv('SEARCH_SERVICE_URL'),
      isMutation: false,
    },
  ]
}
