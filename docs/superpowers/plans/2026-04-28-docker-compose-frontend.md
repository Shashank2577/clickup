# Docker Compose + Vite+React Frontend + Clerk Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `docker-compose up --build` starts 28 containers — Vite+React frontend (port 8080 via Nginx), all 21 backend microservices, Clerk-based auth (GitHub/Google/Microsoft + multi-tenancy), and all infrastructure.

**Architecture:** Nginx on :8080 is the single host entry point routing `/api/*` to the existing api-gateway and `/` to the React SPA. Clerk manages all authentication — the api-gateway verifies Clerk session cookies on every request and the identity-service syncs Clerk webhook events into Postgres. All inter-service URLs switch from `localhost:PORT` to Docker container names.

**Tech Stack:** Vite 5, React 18, TypeScript, TailwindCSS, `@clerk/clerk-react`, `@clerk/backend`, `svix`, Docker multi-stage builds, Nginx alpine, pnpm workspaces.

**Prerequisites:** You must have a Clerk account with an app created. From the Clerk dashboard you need:
- `CLERK_PUBLISHABLE_KEY` (starts with `pk_test_...`)
- `CLERK_SECRET_KEY` (starts with `sk_test_...`)
- Social connections enabled: GitHub, Google, Microsoft
- Organizations feature enabled
- Webhook endpoint created pointing to `http://<host>/api/v1/auth/webhooks/clerk` → get `CLERK_WEBHOOK_SECRET`

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `apps/web/package.json` | Frontend package manifest |
| `apps/web/index.html` | Vite HTML entry |
| `apps/web/vite.config.ts` | Vite config with `/api` proxy for local dev |
| `apps/web/tsconfig.json` | TypeScript config |
| `apps/web/tailwind.config.ts` | Tailwind config |
| `apps/web/postcss.config.cjs` | PostCSS for Tailwind |
| `apps/web/src/main.tsx` | React entrypoint + ClerkProvider |
| `apps/web/src/App.tsx` | Router + route guards |
| `apps/web/src/pages/SignInPage.tsx` | Clerk `<SignIn>` wrapper |
| `apps/web/src/pages/DashboardPage.tsx` | Authenticated shell |
| `apps/web/src/pages/TaskListPage.tsx` | Task list view |
| `apps/web/src/components/Sidebar.tsx` | Workspace/space nav |
| `apps/web/src/lib/api.ts` | Typed fetch wrapper (relative `/api/v1/...` calls) |
| `apps/web/src/lib/types.ts` | Shared TS types |
| `apps/web/Dockerfile` | Multi-stage: node builder → nginx:alpine runtime |
| `apps/web/nginx-spa.conf` | SPA fallback for React Router |
| `apps/web/.env.local` | `VITE_CLERK_PUBLISHABLE_KEY` (gitignored) |
| `Dockerfile.service` | Shared multi-stage Dockerfile for all 21 backend services |
| `nginx/nginx.conf` | Reverse proxy — `/api/*` → api-gateway, `/` → frontend |
| `docker-compose.yml` | All 28 containers, single network, env overrides |
| `services/api-gateway/src/middleware/clerk-auth.ts` | Clerk session verification, replaces JWT path in auth-forward |
| `services/identity-service/src/webhooks/clerk-webhook.handler.ts` | Syncs Clerk user/org events to Postgres |

### Modified
| File | Change |
|---|---|
| `services/api-gateway/src/middleware/auth-forward.ts` | Call `clerkAuth` instead of `requireAuth` for JWT path; add `/api/v1/auth/webhooks` to PUBLIC_PREFIXES |
| `services/api-gateway/src/index.ts` | Remove CORS middleware (Nginx handles it); add `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` env vars |
| `services/api-gateway/.env` | Add `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` |
| `services/identity-service/src/routes.ts` | Add `/auth/webhooks` router using clerk-webhook handler |
| `services/identity-service/.env` | Add `CLERK_WEBHOOK_SECRET` |
| `.gitignore` | Add `apps/web/.env.local` |

---

## Task 1: Scaffold Vite+React app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.cjs`
- Create: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@clickup/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@clerk/clerk-react": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClickUp OSS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create `apps/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 7: Create `apps/web/postcss.config.cjs`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 8: Create `apps/web/src/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Create `apps/web/src/lib/types.ts`**

```typescript
export interface Workspace {
  id: string
  name: string
  slug: string
}

export interface Space {
  id: string
  name: string
  color: string
  workspaceId: string
}

export interface List {
  id: string
  name: string
  spaceId: string
}

export interface Task {
  id: string
  title: string
  priority: 'urgent' | 'high' | 'normal' | 'low' | null
  status: string
  listId: string
  assigneeId: string | null
  dueDate: string | null
}
```

- [ ] **Step 10: Create `apps/web/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 11: Install dependencies**

```bash
cd apps/web && pnpm install
```

Expected: Dependencies installed, no errors.

- [ ] **Step 12: Commit**

```bash
git add apps/web/package.json apps/web/index.html apps/web/vite.config.ts apps/web/tsconfig.json apps/web/tsconfig.node.json apps/web/tailwind.config.ts apps/web/postcss.config.cjs apps/web/src/globals.css apps/web/src/lib/types.ts apps/web/src/test-setup.ts
git commit -m "feat(web): scaffold Vite+React frontend app"
```

---

## Task 2: Add Clerk auth to frontend

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/pages/SignInPage.tsx`
- Create: `apps/web/.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing test for App routing**

Create `apps/web/src/App.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Mock Clerk — it requires a real publishable key in tests
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RedirectToSignIn: () => <div>redirect-to-sign-in</div>,
  useOrganization: () => ({ organization: null }),
  useUser: () => ({ user: { firstName: 'Test' } }),
}))

import { AppRoutes } from './App'

test('renders sign-in redirect for unauthenticated route', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(screen.getByText('redirect-to-sign-in')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — `AppRoutes` not found.

- [ ] **Step 3: Create `apps/web/src/App.tsx`**

```typescript
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignInPage } from './pages/SignInPage'
import { DashboardPage } from './pages/DashboardPage'
import { TaskListPage } from './pages/TaskListPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <DashboardPage />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
      <Route
        path="/list/:listId"
        element={
          <>
            <SignedIn>
              <TaskListPage />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 4: Create `apps/web/src/pages/SignInPage.tsx`**

```typescript
import { SignIn } from '@clerk/clerk-react'

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-in"
        afterSignInUrl="/"
      />
    </div>
  )
}
```

- [ ] **Step 5: Create `apps/web/src/pages/DashboardPage.tsx`** (minimal — full implementation in Task 3)

```typescript
export function DashboardPage() {
  return <div data-testid="dashboard">Dashboard</div>
}
```

- [ ] **Step 6: Create `apps/web/src/pages/TaskListPage.tsx`** (minimal — full implementation in Task 3)

```typescript
export function TaskListPage() {
  return <div data-testid="task-list">Task List</div>
}
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './App'
import './globals.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 8: Create `apps/web/.env.local`** — replace values with your actual Clerk keys

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

- [ ] **Step 9: Add `.env.local` to `.gitignore`**

Open the root `.gitignore` and add (if not already present):

```
apps/web/.env.local
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd apps/web && pnpm test
```

Expected: PASS — 1 test suite, 1 test passed.

- [ ] **Step 11: Verify local dev server starts**

```bash
cd apps/web && pnpm dev
```

Expected: Vite starts on `http://localhost:5173`, browser shows Clerk sign-in with GitHub/Google/Microsoft buttons (requires valid `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`).

Stop the dev server with Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/ .gitignore
git commit -m "feat(web): add Clerk auth — sign-in page with GitHub/Google/Microsoft"
```

---

## Task 3: Build dashboard shell and task list

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Modify: `apps/web/src/pages/TaskListPage.tsx`

- [ ] **Step 1: Write failing test for api.ts**

Create `apps/web/src/lib/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './api'

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls /api/v1/workspaces', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )
    const result = await api.getWorkspaces()
    expect(fetch).toHaveBeenCalledWith('/api/v1/workspaces', expect.any(Object))
    expect(result).toEqual([])
  })

  it('calls /api/v1/spaces/:workspaceId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 's1', name: 'Dev' }] }), { status: 200 }),
    )
    const result = await api.getSpaces('ws1')
    expect(fetch).toHaveBeenCalledWith('/api/v1/workspaces/ws1/spaces', expect.any(Object))
    expect(result).toEqual([{ id: 's1', name: 'Dev' }])
  })

  it('calls /api/v1/tasks/list/:listId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )
    const result = await api.getTasks('list1')
    expect(fetch).toHaveBeenCalledWith('/api/v1/tasks/list/list1', expect.any(Object))
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — `api` not found.

- [ ] **Step 3: Create `apps/web/src/lib/api.ts`**

```typescript
import type { Workspace, Space, List, Task } from './types'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`)
  const json = await res.json()
  return json.data as T
}

export const api = {
  getWorkspaces: () => get<Workspace[]>('/api/v1/workspaces'),
  getSpaces: (workspaceId: string) => get<Space[]>(`/api/v1/workspaces/${workspaceId}/spaces`),
  getLists: (spaceId: string) => get<List[]>(`/api/v1/spaces/${spaceId}/lists`),
  getTasks: (listId: string) => get<Task[]>(`/api/v1/tasks/list/${listId}`),
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test
```

Expected: PASS — all 3 api tests pass.

- [ ] **Step 5: Create `apps/web/src/components/Sidebar.tsx`**

```typescript
import { Link } from 'react-router-dom'
import { UserButton, useOrganization } from '@clerk/clerk-react'
import type { Space, List } from '../lib/types'

interface Props {
  spaces: Space[]
  lists: Record<string, List[]>
  activeListId?: string
}

export function Sidebar({ spaces, lists, activeListId }: Props) {
  const { organization } = useOrganization()

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 text-gray-100 h-screen flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-sm truncate">
          {organization?.name ?? 'ClickUp OSS'}
        </span>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {spaces.map((space) => (
          <div key={space.id} className="mt-2">
            <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {space.name}
            </div>
            {(lists[space.id] ?? []).map((list) => (
              <Link
                key={list.id}
                to={`/list/${list.id}`}
                className={`block px-6 py-1.5 text-sm hover:bg-gray-800 transition-colors ${
                  list.id === activeListId ? 'bg-gray-800 text-white' : 'text-gray-300'
                }`}
              >
                {list.name}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 6: Update `apps/web/src/pages/DashboardPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { api } from '../lib/api'
import type { Space, List } from '../lib/types'

export function DashboardPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [lists, setLists] = useState<Record<string, List[]>>({})

  useEffect(() => {
    api.getWorkspaces().then(async (workspaces) => {
      if (!workspaces[0]) return
      const fetchedSpaces = await api.getSpaces(workspaces[0].id)
      setSpaces(fetchedSpaces)
      const listsBySpace: Record<string, List[]> = {}
      await Promise.all(
        fetchedSpaces.map(async (space) => {
          listsBySpace[space.id] = await api.getLists(space.id)
        }),
      )
      setLists(listsBySpace)
    })
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar spaces={spaces} lists={lists} />
      <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-800">Welcome to ClickUp OSS</h1>
        <p className="mt-2 text-gray-500">Select a list from the sidebar to get started.</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Update `apps/web/src/pages/TaskListPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { api } from '../lib/api'
import type { Space, List, Task } from '../lib/types'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-500',
  high:   'text-orange-500',
  normal: 'text-blue-500',
  low:    'text-gray-400',
}

export function TaskListPage() {
  const { listId } = useParams<{ listId: string }>()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [lists, setLists] = useState<Record<string, List[]>>({})
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getWorkspaces().then(async (workspaces) => {
      if (!workspaces[0]) return
      const fetchedSpaces = await api.getSpaces(workspaces[0].id)
      setSpaces(fetchedSpaces)
      const listsBySpace: Record<string, List[]> = {}
      await Promise.all(
        fetchedSpaces.map(async (space) => {
          listsBySpace[space.id] = await api.getLists(space.id)
        }),
      )
      setLists(listsBySpace)
    })
  }, [])

  useEffect(() => {
    if (!listId) return
    setLoading(true)
    api.getTasks(listId).then((t) => {
      setTasks(t)
      setLoading(false)
    })
  }, [listId])

  return (
    <div className="flex h-screen">
      <Sidebar spaces={spaces} lists={lists} activeListId={listId} />
      <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
        {loading ? (
          <p className="text-gray-400">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-gray-400">No tasks yet.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3"
              >
                <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority ?? 'normal']}`}>
                  {task.priority ?? 'normal'}
                </span>
                <span className="flex-1 text-sm text-gray-800">{task.title}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 8: Run full test suite**

```bash
cd apps/web && pnpm test
```

Expected: PASS — all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add dashboard shell, sidebar, and task list page"
```

---

## Task 4: Frontend Dockerfile

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx-spa.conf`

- [ ] **Step 1: Create `apps/web/nginx-spa.conf`**

```nginx
server {
    listen 5173;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

- [ ] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY apps/web/package.json ./apps/web/
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --filter @clickup/web

COPY apps/web/ ./apps/web/

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN pnpm --filter @clickup/web run build

# ── Runtime stage — nginx:alpine (~25MB) ─────────────────────────────────────
FROM nginx:alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
```

- [ ] **Step 3: Verify Docker build succeeds (uses build arg for Clerk key)**

```bash
docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY \
  -f apps/web/Dockerfile \
  -t clickup-web:local \
  .
```

Expected: Build completes, final image uses nginx:alpine, no node_modules in final stage.

Verify image size:
```bash
docker image ls clickup-web:local --format "{{.Size}}"
```

Expected: Under 50MB.

- [ ] **Step 4: Commit**

```bash
git add apps/web/Dockerfile apps/web/nginx-spa.conf
git commit -m "feat(web): add multi-stage Dockerfile — nginx:alpine final image"
```

---

## Task 5: Clerk auth middleware in api-gateway

**Files:**
- Create: `services/api-gateway/src/middleware/clerk-auth.ts`
- Modify: `services/api-gateway/src/middleware/auth-forward.ts`
- Modify: `services/api-gateway/.env`

- [ ] **Step 1: Install Clerk backend SDK in api-gateway**

```bash
cd services/api-gateway && pnpm add @clerk/backend
```

- [ ] **Step 2: Write failing test for clerk-auth middleware**

Create `services/api-gateway/src/middleware/clerk-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    authenticateRequest: vi.fn(),
  })),
}))

import { createClerkClient } from '@clerk/backend'
import { clerkAuth } from './clerk-auth'

const mockClerk = vi.mocked(createClerkClient)

function makeReq(overrides?: Partial<Request>): Request {
  return { headers: {}, ...overrides } as unknown as Request
}
function makeRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
}

describe('clerkAuth', () => {
  it('sets x-user-id and x-org-id headers when session is valid', async () => {
    const instance = mockClerk.mock.results[0]?.value ?? { authenticateRequest: vi.fn() }
    vi.mocked(instance.authenticateRequest).mockResolvedValueOnce({
      isSignedIn: true,
      toAuth: () => ({ userId: 'user_abc', orgId: 'org_xyz', sessionId: 'sess_1' }),
    } as any)

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(req.headers['x-user-id']).toBe('user_abc')
    expect(req.headers['x-org-id']).toBe('org_xyz')
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 401 when session is not signed in', async () => {
    const instance = mockClerk.mock.results[0]?.value ?? { authenticateRequest: vi.fn() }
    vi.mocked(instance.authenticateRequest).mockResolvedValueOnce({
      isSignedIn: false,
      toAuth: () => null,
    } as any)

    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await clerkAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd services/api-gateway && pnpm test
```

Expected: FAIL — `clerkAuth` not found.

- [ ] **Step 4: Create `services/api-gateway/src/middleware/clerk-auth.ts`**

```typescript
import { createClerkClient } from '@clerk/backend'
import type { Request, Response, NextFunction } from 'express'

const clerk = createClerkClient({
  secretKey: process.env['CLERK_SECRET_KEY'],
  publishableKey: process.env['CLERK_PUBLISHABLE_KEY'],
})

export async function clerkAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestState = await clerk.authenticateRequest(req as any, {
      secretKey: process.env['CLERK_SECRET_KEY'],
      publishableKey: process.env['CLERK_PUBLISHABLE_KEY'],
    })

    if (!requestState.isSignedIn) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const auth = requestState.toAuth()!
    req.headers['x-user-id'] = auth.userId
    if (auth.orgId) req.headers['x-org-id'] = auth.orgId
    if (auth.sessionId) req.headers['x-session-id'] = auth.sessionId
    next()
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd services/api-gateway && pnpm test
```

Expected: PASS.

- [ ] **Step 6: Update `services/api-gateway/src/middleware/auth-forward.ts`**

Replace the `// ── JWT path ───` block and add the Clerk webhook to PUBLIC_PREFIXES:

```typescript
import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../db.js'
import { clerkAuth } from './clerk-auth.js'

const PUBLIC_PREFIXES = [
  '/api/v1/auth/webhooks',   // Clerk webhook — verified by svix, not Clerk session
  '/api/v1/forms/submit/',
  '/api/v1/tasks/share/',
  '/api/v1/docs/shared/',
  '/health',
]

const INTERNAL_HEADERS = ['x-user-id', 'x-user-role', 'x-org-id', 'x-workspace-id', 'x-session-id', 'x-api-key-id', 'x-api-key-scopes']

function isPublic(path: string, method: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || path.endsWith('/health')) {
    return true
  }
  if (method === 'GET' && path.includes('/tasks/share/')) return true
  return false
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function validateApiKey(raw: string): Promise<{
  userId: string
  workspaceId: string
  scopes: string[]
  keyId: string
} | null> {
  const hash = createHash('sha256').update(raw).digest('hex')
  const { rows } = await db.query<{
    id: string
    user_id: string
    workspace_id: string
    scopes: string[]
  }>(
    `SELECT id, user_id, workspace_id, scopes
     FROM api_keys
     WHERE key_hash = $1
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [hash],
  )
  if (!rows[0]) return null
  db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {})
  return {
    keyId: rows[0].id,
    userId: rows[0].user_id,
    workspaceId: rows[0].workspace_id,
    scopes: rows[0].scopes ?? [],
  }
}

export function authForward(req: Request, res: Response, next: NextFunction): void {
  for (const header of INTERNAL_HEADERS) {
    delete req.headers[header]
  }

  const path = req.originalUrl || req.url
  if (isPublic(path, req.method)) {
    next()
    return
  }

  const token = extractBearerToken(req)

  // ── API key path (cu_ prefix) ──────────────────────────────────────────────
  if (token?.startsWith('cu_')) {
    validateApiKey(token)
      .then((info) => {
        if (!info) {
          res.status(401).json({ error: 'API key invalid or expired' })
          return
        }
        req.headers['x-user-id']        = info.userId
        req.headers['x-workspace-id']   = info.workspaceId
        req.headers['x-api-key-id']     = info.keyId
        req.headers['x-api-key-scopes'] = info.scopes.join(',')
        req.headers['x-user-role']      = 'member'
        next()
      })
      .catch((err) => next(err))
    return
  }

  // ── Clerk session path ─────────────────────────────────────────────────────
  clerkAuth(req, res, next)
}
```

- [ ] **Step 7: Add Clerk keys to `services/api-gateway/.env`**

```bash
echo "" >> services/api-gateway/.env
echo "CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE" >> services/api-gateway/.env
echo "CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE" >> services/api-gateway/.env
```

Replace `sk_test_YOUR_SECRET_KEY_HERE` and `pk_test_YOUR_PUBLISHABLE_KEY_HERE` with your real Clerk keys.

- [ ] **Step 8: Run tests**

```bash
cd services/api-gateway && pnpm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add services/api-gateway/src/middleware/ services/api-gateway/.env
git commit -m "feat(gateway): replace JWT verify with Clerk session auth"
```

---

## Task 6: Clerk webhook sync in identity-service

**Files:**
- Create: `services/identity-service/src/webhooks/clerk-webhook.handler.ts`
- Modify: `services/identity-service/src/routes.ts`
- Modify: `services/identity-service/.env`

- [ ] **Step 1: Install svix for webhook verification**

```bash
cd services/identity-service && pnpm add svix
```

- [ ] **Step 2: Write failing test for webhook handler**

Create `services/identity-service/src/webhooks/clerk-webhook.handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Pool } from 'pg'
import type { Request, Response } from 'express'

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}))

import { Webhook } from 'svix'
import { clerkWebhookRoutes } from './clerk-webhook.handler'

const mockDb = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
} as unknown as Pool

function makeReq(body: object, headers: Record<string, string> = {}): Request {
  return {
    headers: {
      'svix-id': 'msg_test',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,sig',
      ...headers,
    },
    body,
  } as unknown as Request
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() }
  return res as any
}

describe('Clerk webhook handler', () => {
  let mockVerify: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    const wh = new (Webhook as any)('secret')
    mockVerify = wh.verify
  })

  it('upserts user on user.created event', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: 'user_clerk_1',
        email_addresses: [{ email_address: 'test@example.com', id: 'em_1' }],
        primary_email_address_id: 'em_1',
        first_name: 'Alice',
        last_name: 'Smith',
      },
    }
    mockVerify.mockReturnValueOnce(payload)

    const router = clerkWebhookRoutes(mockDb)
    const handler = (router as any).stack[0].route.stack[0].handle
    const req = makeReq(payload)
    const res = makeRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['user_clerk_1', 'test@example.com']),
    )
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('returns 400 on invalid svix signature', async () => {
    mockVerify.mockImplementationOnce(() => { throw new Error('Invalid signature') })

    const router = clerkWebhookRoutes(mockDb)
    const handler = (router as any).stack[0].route.stack[0].handle
    const req = makeReq({})
    const res = makeRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd services/identity-service && pnpm test
```

Expected: FAIL — `clerkWebhookRoutes` not found.

- [ ] **Step 4: Create `services/identity-service/src/webhooks/clerk-webhook.handler.ts`**

```typescript
import { Router } from 'express'
import type { Pool } from 'pg'
import { Webhook } from 'svix'

interface ClerkUserPayload {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses: Array<{ id: string; email_address: string }>
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
  }
}

interface ClerkOrgPayload {
  type: 'organization.created' | 'organization.updated' | 'organization.deleted'
  data: {
    id: string
    name: string
    slug: string
    created_by: string
  }
}

interface ClerkMembershipPayload {
  type: 'organizationMembership.created' | 'organizationMembership.deleted'
  data: {
    organization: { id: string }
    public_user_data: { user_id: string }
    role: string
  }
}

type ClerkEvent = ClerkUserPayload | ClerkOrgPayload | ClerkMembershipPayload

export function clerkWebhookRoutes(db: Pool): Router {
  const router = Router()

  router.post('/clerk', async (req, res) => {
    const webhookSecret = process.env['CLERK_WEBHOOK_SECRET']
    if (!webhookSecret) {
      res.status(500).json({ error: 'CLERK_WEBHOOK_SECRET not configured' })
      return
    }

    const wh = new Webhook(webhookSecret)
    let event: ClerkEvent

    try {
      event = wh.verify(JSON.stringify(req.body), {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      }) as ClerkEvent
    } catch {
      res.status(400).json({ error: 'Invalid webhook signature' })
      return
    }

    try {
      await handleEvent(db, event)
      res.json({ received: true })
    } catch (err) {
      res.status(500).json({ error: 'Webhook processing failed' })
    }
  })

  return router
}

async function handleEvent(db: Pool, event: ClerkEvent): Promise<void> {
  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const d = event.data as ClerkUserPayload['data']
      const primaryEmail = d.email_addresses.find((e) => e.id === d.primary_email_address_id)
      if (!primaryEmail) return
      const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || primaryEmail.email_address
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, timezone)
         VALUES ($1, $2, $3, '', 'UTC')
         ON CONFLICT (id) DO UPDATE SET email = $2, name = $3`,
        [d.id, primaryEmail.email_address, name],
      )
      break
    }

    case 'user.deleted': {
      const d = event.data as ClerkUserPayload['data']
      await db.query('DELETE FROM users WHERE id = $1', [d.id])
      break
    }

    case 'organization.created':
    case 'organization.updated': {
      const d = event.data as ClerkOrgPayload['data']
      await db.query(
        `INSERT INTO workspaces (id, name, slug, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3`,
        [d.id, d.name, d.slug, d.created_by],
      )
      break
    }

    case 'organization.deleted': {
      const d = event.data as ClerkOrgPayload['data']
      await db.query('DELETE FROM workspaces WHERE id = $1', [d.id])
      break
    }

    case 'organizationMembership.created': {
      const d = event.data as ClerkMembershipPayload['data']
      const role = d.role === 'org:admin' ? 'owner' : 'member'
      await db.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3`,
        [d.organization.id, d.public_user_data.user_id, role],
      )
      break
    }

    case 'organizationMembership.deleted': {
      const d = event.data as ClerkMembershipPayload['data']
      await db.query(
        'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [d.organization.id, d.public_user_data.user_id],
      )
      break
    }
  }
}
```

- [ ] **Step 5: Update `services/identity-service/src/routes.ts`** — add webhook router

```typescript
import { Router } from 'express'
import type { Pool } from 'pg'
import { authRoutes } from './auth/auth.handler.js'
import { usersRoutes } from './users/users.handler.js'
import { workspacesRoutes } from './workspaces/workspaces.handler.js'
import { workspaceSpacesRoutes, spacesRoutes } from './spaces/spaces.handler.js'
import { spaceListsRoutes, listsRoutes } from './lists/lists.handler.js'
import { favoritesRoutes } from './favorites/favorites.handler.js'
import { teamsRoutes } from './teams/teams.handler.js'
import { trashRoutes } from './trash/trash.handler.js'
import { sidebarRoutes } from './sidebar/sidebar.handler.js'
import { presenceRoutes } from './presence/presence.handler.js'
import { preferencesRoutes } from './preferences/preferences.handler.js'
import { clerkWebhookRoutes } from './webhooks/clerk-webhook.handler.js'

export function routes(db: Pool): Router {
  const router = Router()

  // Clerk webhook — raw body needed for svix signature verification
  router.use('/auth/webhooks', express.raw({ type: 'application/json' }), clerkWebhookRoutes(db))

  router.use('/auth', authRoutes(db))
  router.use('/users', presenceRoutes(db))
  router.use('/users', preferencesRoutes(db))
  router.use('/users', usersRoutes(db))
  router.use('/workspaces/:workspaceId/spaces', workspaceSpacesRoutes(db))
  router.use('/workspaces', workspacesRoutes(db))
  router.use('/spaces/:spaceId/lists', spaceListsRoutes(db))
  router.use('/spaces', spacesRoutes(db))
  router.use('/lists', listsRoutes(db))
  router.use('/favorites', favoritesRoutes(db))
  router.use('/teams', teamsRoutes(db))
  router.use('/trash', trashRoutes(db))
  router.use('/sidebar', sidebarRoutes(db))
  return router
}
```

Note: Add `import express from 'express'` at the top of `routes.ts` so `express.raw()` is available.

- [ ] **Step 6: Add webhook secret to `services/identity-service/.env`**

```bash
echo "CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE" >> services/identity-service/.env
```

Replace with your real Clerk webhook signing secret from the Clerk dashboard.

- [ ] **Step 7: Run tests**

```bash
cd services/identity-service && pnpm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/identity-service/src/webhooks/ services/identity-service/src/routes.ts services/identity-service/.env
git commit -m "feat(identity): add Clerk webhook sync for users, orgs, and memberships"
```

---

## Task 7: Shared backend Dockerfile

**Files:**
- Create: `Dockerfile.service`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
**/node_modules
**/.pnpm-store
**/dist
**/*.log
.git
.github
docs
infra/migrations
```

- [ ] **Step 2: Create `Dockerfile.service`**

```dockerfile
# syntax=docker/dockerfile:1
# Shared Dockerfile for all backend microservices.
# Usage: build with --build-arg SERVICE_NAME=identity-service from repo root.

ARG SERVICE_NAME

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
ARG SERVICE_NAME
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Workspace manifests (for dependency resolution)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Shared packages
COPY packages/ ./packages/

# Service source
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# Install workspace deps for this service and its transitive workspace deps
RUN pnpm install --frozen-lockfile --filter @clickup/${SERVICE_NAME}...

# Build shared packages then the service (... means build deps first)
RUN pnpm run --filter @clickup/${SERVICE_NAME}... build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ARG SERVICE_NAME
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Workspace resolution files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Package manifests only (pnpm needs these to resolve workspace links)
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/sdk/package.json ./packages/sdk/

# Built package output from builder
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist

# Service manifest + built output
COPY services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/
COPY --from=builder /app/services/${SERVICE_NAME}/dist ./services/${SERVICE_NAME}/dist

# Prod-only deps install
RUN pnpm install --frozen-lockfile --prod --filter @clickup/${SERVICE_NAME}...

WORKDIR /app/services/${SERVICE_NAME}
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Verify Dockerfile builds one service correctly**

```bash
docker build \
  --build-arg SERVICE_NAME=identity-service \
  -f Dockerfile.service \
  -t clickup-identity:local \
  .
```

Expected: Build completes successfully.

Verify image size:
```bash
docker image ls clickup-identity:local --format "{{.Size}}"
```

Expected: Under 300MB (node:alpine + prod deps only).

- [ ] **Step 4: Commit**

```bash
git add Dockerfile.service .dockerignore
git commit -m "feat(docker): add shared multi-stage Dockerfile for backend services"
```

---

## Task 8: Nginx reverse proxy

**Files:**
- Create: `nginx/nginx.conf`

- [ ] **Step 1: Create `nginx/nginx.conf`**

```nginx
upstream api_gateway {
    server api-gateway:3000;
}

upstream frontend {
    server frontend:5173;
}

server {
    listen 80;

    # Clerk webhook — must preserve raw body, no buffering
    location /api/v1/auth/webhooks/ {
        proxy_pass http://api_gateway/api/v1/auth/webhooks/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass_header Cookie;
        proxy_pass_header Set-Cookie;
        proxy_request_buffering off;
    }

    # All other /api/* traffic → api-gateway (strips /api prefix)
    location /api/ {
        proxy_pass http://api_gateway/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        # Pass auth cookies through
        proxy_pass_header Cookie;
        proxy_pass_header Set-Cookie;
    }

    # All other traffic → React SPA
    location / {
        proxy_pass http://frontend/;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx/nginx.conf
git commit -m "feat(nginx): add reverse proxy — /api/* to gateway, / to frontend"
```

---

## Task 9: Write docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# Single compose file — starts all 28 containers.
# Run: docker-compose up --build
# Access: http://localhost:8080

name: clickup

networks:
  clickup-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  nats_data:
  elastic_data:
  minio_data:

x-backend-common: &backend-common
  build:
    context: .
    dockerfile: Dockerfile.service
  networks: [clickup-net]
  restart: unless-stopped
  environment:
    # Override localhost URLs with Docker container names
    POSTGRES_HOST: postgres
    REDIS_HOST: redis
    NATS_URL: nats://nats:4222
    ELASTICSEARCH_URL: http://elasticsearch:9200
    MINIO_ENDPOINT: minio
    # Inter-service URLs
    IDENTITY_SERVICE_URL: http://identity-service:3001
    TASK_SERVICE_URL: http://task-service:3002
    COMMENT_SERVICE_URL: http://comment-service:3003
    NOTIFICATION_SERVICE_URL: http://notification-service:3004
    FILE_SERVICE_URL: http://file-service:3005
    AI_SERVICE_URL: http://ai-service:3006
    AUTOMATIONS_SERVICE_URL: http://automations-service:3007
    SEARCH_SERVICE_URL: http://search-service:3008
    GOAL_SERVICE_URL: http://goals-service:3009
    DOCS_SERVICE_URL: http://docs-service:3010
    VIEWS_SERVICE_URL: http://views-service:3011
    WEBHOOKS_SERVICE_URL: http://webhooks-service:3012
    SPRINT_SERVICE_URL: http://sprint-service:3013
    DASHBOARD_SERVICE_URL: http://dashboard-service:3014
    SLACK_SERVICE_URL: http://slack-service:3015
    GITHUB_SERVICE_URL: http://github-integration:3016
    GITLAB_SERVICE_URL: http://gitlab-integration:3017
    CHAT_SERVICE_URL: http://chat-service:3021
    AUDIT_SERVICE_URL: http://audit-service:3023
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    nats:
      condition: service_started

services:

  # ── Infrastructure ─────────────────────────────────────────────────────────

  postgres:
    image: postgres:16-alpine
    networks: [clickup-net]
    environment:
      POSTGRES_DB: clickup
      POSTGRES_USER: clickup
      POSTGRES_PASSWORD: clickup_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/migrations/001_initial.sql:/docker-entrypoint-initdb.d/001_initial.sql
      - ./infra/migrations/002_research_improvements.sql:/docker-entrypoint-initdb.d/002_research_improvements.sql
      - ./infra/migrations/003_add_password_hash.sql:/docker-entrypoint-initdb.d/003_add_password_hash.sql
      - ./infra/migrations/004_doc_snapshots.sql:/docker-entrypoint-initdb.d/004_doc_snapshots.sql
      - ./infra/migrations/004_favorites_teams_trash_sidebar_presence_theming.sql:/docker-entrypoint-initdb.d/004b_favorites_teams.sql
      - ./infra/migrations/005_automation_runs.sql:/docker-entrypoint-initdb.d/005_automation_runs.sql
      - ./infra/migrations/006_views.sql:/docker-entrypoint-initdb.d/006_views.sql
      - ./infra/migrations/007_webhooks.sql:/docker-entrypoint-initdb.d/007_webhooks.sql
      - ./infra/migrations/008_wave3_features.sql:/docker-entrypoint-initdb.d/008_wave3_features.sql
      - ./infra/migrations/009_wave4_features.sql:/docker-entrypoint-initdb.d/009_wave4_features.sql
      - ./infra/migrations/010_wave5_features.sql:/docker-entrypoint-initdb.d/010_wave5_features.sql
      - ./infra/migrations/011_wave5b_gaps.sql:/docker-entrypoint-initdb.d/011_wave5b_gaps.sql
      - ./infra/migrations/012_chat.sql:/docker-entrypoint-initdb.d/012_chat.sql
      - ./infra/migrations/013_notification_views_dashboard_forms_audit.sql:/docker-entrypoint-initdb.d/013_notification_views.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U clickup']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    networks: [clickup-net]
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

  nats:
    image: nats:2.10-alpine
    networks: [clickup-net]
    command: ['--jetstream', '--store_dir=/data']
    volumes:
      - nats_data:/data

  elasticsearch:
    image: elasticsearch:8.12.0
    networks: [clickup-net]
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    volumes:
      - elastic_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ['CMD-SHELL', 'curl -s http://localhost:9200/_cluster/health | grep -q "green\|yellow"']
      interval: 10s
      timeout: 10s
      retries: 10

  minio:
    image: minio/minio:latest
    networks: [clickup-net]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: clickup_dev
      MINIO_ROOT_PASSWORD: clickup_dev_secret
    volumes:
      - minio_data:/data

  # ── Backend services ────────────────────────────────────────────────────────

  api-gateway:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: api-gateway
    env_file: ./services/api-gateway/.env

  identity-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: identity-service
    env_file: ./services/identity-service/.env

  task-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: task-service
    env_file: ./services/task-service/.env

  comment-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: comment-service
    env_file: ./services/comment-service/.env

  notification-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: notification-service
    env_file: ./services/notification-service/.env

  file-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: file-service
    env_file: ./services/file-service/.env

  ai-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: ai-service
    env_file: ./services/ai-service/.env

  automations-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: automations-service
    env_file: ./services/automations-service/.env

  search-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: search-service
    env_file: ./services/search-service/.env

  goals-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: goals-service
    env_file: ./services/goals-service/.env

  docs-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: docs-service
    env_file: ./services/docs-service/.env

  views-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: views-service
    env_file: ./services/views-service/.env

  webhooks-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: webhooks-service
    env_file: ./services/webhooks-service/.env

  sprint-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: sprint-service
    env_file: ./services/sprint-service/.env

  dashboard-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: dashboard-service
    env_file: ./services/dashboard-service/.env

  slack-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: slack-service

  github-integration:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: github-integration

  gitlab-integration:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: gitlab-integration

  chat-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: chat-service
    env_file: ./services/chat-service/.env

  audit-service:
    <<: *backend-common
    build:
      context: .
      dockerfile: Dockerfile.service
      args:
        SERVICE_NAME: audit-service

  # ── Frontend ────────────────────────────────────────────────────────────────

  frontend:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_CLERK_PUBLISHABLE_KEY: ${VITE_CLERK_PUBLISHABLE_KEY}
    networks: [clickup-net]
    restart: unless-stopped

  # ── Reverse proxy (single host entry point) ─────────────────────────────────

  nginx:
    image: nginx:alpine
    networks: [clickup-net]
    ports:
      - "8080:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - api-gateway
    restart: unless-stopped
```

- [ ] **Step 2: Create `.env` at repo root** for docker-compose build args

```bash
cat > .env << 'EOF'
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
EOF
```

Replace with your real Clerk publishable key.

- [ ] **Step 3: Validate compose file syntax**

```bash
docker-compose config --quiet && echo "Compose file is valid"
```

Expected: `Compose file is valid` — no errors.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env
git commit -m "feat(docker): single docker-compose.yml for all 28 containers"
```

---

## Task 10: Smoke test — full stack

- [ ] **Step 1: Stop any locally running services**

```bash
pkill -f "tsx watch" || true
```

- [ ] **Step 2: Start all containers**

```bash
docker-compose up --build -d
```

Expected: All 28 containers start. First build takes 5-15 minutes due to pnpm installs.

- [ ] **Step 3: Verify Nginx is up**

```bash
curl -s http://localhost:8080 | grep -i "clickup\|root\|html"
```

Expected: HTML response (React app's index.html).

- [ ] **Step 4: Verify API Gateway health through Nginx**

```bash
curl -s http://localhost:8080/api/health
```

Expected:
```json
{"status":"ok","service":"api-gateway"}
```

- [ ] **Step 5: Verify identity-service is reachable through gateway**

```bash
curl -s http://localhost:8080/api/v1/auth/verify
```

Expected: `401` response (valid — means the gateway correctly rejected the unauthenticated request).

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/auth/verify
```

Expected: `401`

- [ ] **Step 6: Open browser and verify sign-in flow**

Open `http://localhost:8080` in a browser.

Expected:
- Clerk sign-in page loads with GitHub, Google, and Microsoft buttons
- No console errors about missing Clerk key
- Signing in with any social provider redirects to the dashboard
- Dashboard shows sidebar with workspace name from Clerk Organization

- [ ] **Step 7: Check container logs for errors**

```bash
docker-compose logs nginx --tail=20
docker-compose logs api-gateway --tail=20
docker-compose logs identity-service --tail=20
docker-compose logs frontend --tail=20
```

Expected: No ERROR lines in any service.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: full Docker Compose stack — frontend + 21 services + Clerk auth on :8080"
```

---

## Quick Reference

### Start everything
```bash
docker-compose up --build
```

### Stop everything
```bash
docker-compose down
```

### View logs for one service
```bash
docker-compose logs -f identity-service
```

### Restart one service after code change
```bash
docker-compose up --build identity-service -d
```

### Local dev (no Docker)
```bash
# Terminal 1 — infrastructure
docker-compose up postgres redis nats elasticsearch minio -d

# Terminal 2 — api-gateway
cd services/api-gateway && pnpm dev

# Terminal 3 — identity-service
cd services/identity-service && pnpm dev

# Terminal 4 — frontend
cd apps/web && pnpm dev
# Visit http://localhost:5173
```

### Migration path from old infra compose
The old `infra/docker-compose.yml` can be deleted once you've verified `docker-compose up` works. The new root `docker-compose.yml` includes all infrastructure.
