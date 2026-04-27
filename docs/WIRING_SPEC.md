# Frontend ↔ Backend Wiring Specification

> Complete mapping of every frontend component to its backend endpoints.
> Use this to wire demo data to real API calls. Generated 2026-04-27.

---

## Infrastructure Already Created

| Layer | File | Status |
|-------|------|--------|
| API Client | `apps/web/src/lib/api-client.ts` | DONE - fetch wrapper with auth, error handling, upload |
| WebSocket | `apps/web/src/lib/websocket.ts` | DONE - connect, subscribe, on/off, reconnect |
| Auth Store | `apps/web/src/stores/auth-store.ts` | DONE - login, logout, loadCurrentUser, workspace selection |
| Workspace Store | `apps/web/src/stores/workspace-store.ts` | DONE - spaces, lists, members, favorites |
| Task Store | `apps/web/src/stores/task-store.ts` | DONE - CRUD, comments, attachments, time, relations |
| Notification Store | `apps/web/src/stores/notification-store.ts` | DONE - list, read, snooze, clear, tabs |
| UI Store | `apps/web/src/stores/ui-store.ts` | DONE - sidebar, command palette, task detail |

## Gateway Routing (api-gateway proxy.config.ts)

All calls go through `http://localhost:3000/api/v1/*`. The gateway forwards:

| Frontend calls to | Gateway prefix | Backend service (port) |
|---|---|---|
| Auth, Users, Workspaces, Spaces, Lists | `/api/v1/auth`, `/users`, `/workspaces`, `/spaces`, `/lists`, `/folders`, `/invites`, `/favorites`, `/teams`, `/trash`, `/sidebar` | identity-service (3001) |
| Tasks, Custom Fields, Statuses, Templates, Forms | `/api/v1/tasks`, `/custom-fields`, `/list-statuses`, `/task-templates`, `/forms`, `/task-types` | task-service (3002) |
| Comments | `/api/v1/comments` | comment-service (3009) |
| Notifications, Reminders | `/api/v1/notifications` | notification-service (3008) |
| AI | `/api/v1/ai` | ai-service (3006) |
| Files | `/api/v1/files` | file-service (3012) |
| Search | `/api/v1/search` | search-service (3011) |
| Docs | `/api/v1/docs` | docs-service (3010) |
| Views | `/api/v1/views` | views-service (3013) |
| Dashboards | `/api/v1/dashboards` | dashboard-service (3014) |
| Goals | `/api/v1/goals` | goals-service (3015) |
| Sprints | `/api/v1/sprints` | sprint-service (3016) |
| Automations | `/api/v1/automations` | automations-service (3007) |
| Chat (channels, DMs, messages) | `/api/v1/channels`, `/api/v1/dm`, `/api/v1/messages` | chat-service (3021) |

### MISSING Gateway Routes (need to be added to proxy.config.ts)

| Prefix | Service | Why |
|---|---|---|
| `/api/v1/channels`, `/api/v1/dm`, `/api/v1/messages` | chat-service (3021) | Chat service was created but not added to gateway |
| `/api/v1/favorites` | identity-service (3001) | Favorites handler exists but may not have gateway route |
| `/api/v1/teams` | identity-service (3001) | Teams handler exists but may not have gateway route |
| `/api/v1/trash` | identity-service (3001) | Trash handler exists but may not have gateway route |
| `/api/v1/sidebar` | identity-service (3001) | Sidebar handler exists but may not have gateway route |
| `/api/v1/audit-logs` | audit-service (3023) | Audit service created but not in gateway |
| `/api/v1/form-service` | form-service (3022) | Form service created but not in gateway (task-service already has /forms) |

---

## Screen-by-Screen Wiring Map

### 1. Root Layout (`src/app/layout.tsx`)

**On app load:**
```
1. useAuthStore.loadCurrentUser() → GET /api/v1/users/me
2. If authenticated:
   a. useAuthStore.loadWorkspaces() → GET /api/v1/workspaces/me
   b. useWorkspaceStore.loadSpaces(workspaceId) → GET /api/v1/workspaces/:id/spaces + GET /api/v1/spaces/:id/lists per space
   c. useWorkspaceStore.loadFavorites(workspaceId) → GET /api/v1/favorites
   d. wsClient.connect(token) → WebSocket to ws://localhost:3000/ws
   e. wsClient.subscribe(`workspace:${workspaceId}`)
   f. wsClient.subscribe(`user:${userId}`)
3. If NOT authenticated: redirect to /login
```

**Missing page: `/login`** — Need to create `src/app/login/page.tsx` with email/password form calling `useAuthStore.login()`.

---

### 2. Icon Rail (`src/components/layout/icon-rail.tsx`)

| Element | Replace | With |
|---|---|---|
| Workspace avatar "C" | Hardcoded | `useAuthStore.workspace.name[0]` |
| Notification badge on Inbox icon | None | `useNotificationStore.unreadCount` → GET /api/v1/notifications/unread-count |

---

### 3. Sidebar (`src/components/layout/sidebar.tsx`)

| Element | Replace | With |
|---|---|---|
| Spaces tree | Hardcoded "Space", "Team Space" | `useWorkspaceStore.spaces` (already loaded on mount) |
| List items + counts | Hardcoded "General Project Manager (4)" | `space.lists` from workspace store |
| Favorites section | Empty placeholder | `useWorkspaceStore.favorites` |
| Channels | Hardcoded "General", "Welcome" | `GET /api/v1/channels?workspaceId=X` (chat-service) |
| DMs | Hardcoded "Shashank Saxena" | `GET /api/v1/dm` (chat-service) |
| "New Space" button | No handler | `useWorkspaceStore.createSpace()` → POST /api/v1/workspaces/:id/spaces |
| "+" on space | No handler | `useWorkspaceStore.createList()` → POST /api/v1/spaces/:id/lists |
| "Add Channel" | No handler | `POST /api/v1/channels` (chat-service) |

---

### 4. Top Bar (`src/components/layout/top-bar.tsx`)

| Element | Replace | With |
|---|---|---|
| "My Workspace" | Hardcoded | `useAuthStore.workspace.name` |
| Avatar "SS" | Hardcoded | `useAuthStore.user.initials` |
| "+ Create" button | No handler | Open create modal → POST /api/v1/tasks (or list/space/doc) |
| Search bar click | Opens command palette | Already wired via `onSearchClick` |
| Notification bell | No badge | `useNotificationStore.unreadCount` |

---

### 5. Command Palette (`src/components/layout/command-palette.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoResults` array | 7 hardcoded results | `GET /api/v1/search?q=${query}&workspaceId=X` (debounced 300ms) |
| Source tabs (ClickUp/GitHub/etc) | Static | `GET /api/v1/search?q=${query}&source=${tab}` |
| Filter tabs (Tasks/Docs/etc) | Static | `GET /api/v1/search?q=${query}&type=${filter}` |
| "Ask AI" button | No handler | `POST /api/v1/ai/ask` |
| Result click | No handler | `router.push()` to task/doc/list URL |

---

### 6. Space View (`src/components/views/space-view.tsx`)

| Element | Replace | With |
|---|---|---|
| "General Project Manager" | Hardcoded | Route param → `GET /api/v1/lists/:listId` |
| View tabs | Hardcoded array | `GET /api/v1/views/list/:listId` |
| Star/favorite | No handler | `useWorkspaceStore.addFavorite('list', listId)` |
| "+ View" button | No handler | `POST /api/v1/views` |

---

### 7. List View (`src/components/views/list-view.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoGroups` | 4 hardcoded parent tasks | `useTaskStore.loadTasks(listId, groupBy)` → GET /api/v1/tasks/list/:listId |
| Status badges | Static config | `GET /api/v1/list-statuses/lists/:listId/statuses` |
| Task click | Opens TaskDetail | `useUIStore.openTaskDetail(taskId)` + `useTaskStore.loadTaskDetail(taskId)` |
| "+ Add Task" | No handler | `useTaskStore.createTask({ title, listId, status })` |
| Column sort | No handler | Update view state → PATCH /api/v1/views/:viewId/state |
| Filter/Assignee buttons | No handler | Query params on GET /api/v1/tasks |
| Inline status change | No handler | `useTaskStore.updateTask(taskId, { status })` |

---

### 8. Board View (`src/components/views/board-view.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoColumns` | 5 hardcoded columns | Same as list view, grouped by status |
| Card drag-and-drop | Not implemented | `useTaskStore.updateTask(taskId, { status: newStatus })` + reorder |
| "+ Add Task" per column | No handler | `useTaskStore.createTask({ title, listId, status: columnStatus })` |
| "+ Add group" | No handler | `POST /api/v1/list-statuses/lists/:listId/statuses` |

---

### 9. Task Detail (`src/components/task/task-detail.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoTask` | Hardcoded object | `useTaskStore.taskDetail` ← `loadTaskDetail(taskId)` |
| Status dropdown | Local state only | `useTaskStore.updateTask(taskId, { status })` |
| Priority dropdown | Local state only | `useTaskStore.updateTask(taskId, { priority })` |
| Assignees | Shows "Empty" | `GET /api/v1/workspaces/:id/members` for picker, `POST /api/v1/tasks/:id/assignees` |
| Dates | Display only | `useTaskStore.updateTask(taskId, { startDate, dueDate })` |
| Tags | Shows "Empty" | Workspace tags picker, `PATCH /api/v1/tasks/:id` with tags |
| Track Time | "Add time" placeholder | `POST /api/v1/tasks/:id/time-entries/timer/start` / `stop` |
| Relationships | Shows "Empty" | `useTaskStore.addRelation()` → `POST /api/v1/tasks/:id/relations` |
| Description | "Add description" | `useTaskStore.updateTask(taskId, { description })` |
| "Write with AI" | No handler | `POST /api/v1/ai/ask` with context |
| Custom fields | Shows dashes | `GET /api/v1/tasks/:id/custom-fields` + `PUT /api/v1/tasks/:id/custom-fields/:fieldId` |
| Subtasks | Hardcoded 3 items | Subtasks come from `task.subtasks` in loadTaskDetail response |
| "+ Add Task" (subtask) | No handler | `useTaskStore.createTask({ title, listId, parentId: taskId })` |
| Checklists | "Create checklist" | `useTaskStore.createChecklist(taskId, title)` |
| Attachments | Drag zone placeholder | `useTaskStore.addAttachment(taskId, file)` → `POST /api/v1/files` |
| Activity entries | Hardcoded 2 items | `GET /api/v1/tasks/:id/activity` |
| Comments | Static input | `useTaskStore.addComment(taskId, content)` → `POST /api/v1/comments/tasks/:id/comments` |
| Comment reactions | Icon buttons | `POST /api/v1/comments/:id/reactions` |
| "Ask AI" button | No handler | `POST /api/v1/ai/ask` |
| "Prioritize with AI" | No handler | `POST /api/v1/ai/prioritize` |
| Context menu actions | All no-ops | Move: PATCH task.listId, Duplicate: POST /:id/duplicate, Merge: POST /:id/merge, Archive: POST /:id/archive, Delete: DELETE /:id |

**WebSocket:** Subscribe to `task:${taskId}` on open, handle `task.updated`, `comment.created` events.

---

### 10. My Tasks (`src/components/views/my-tasks.tsx`)

| Element | Replace | With |
|---|---|---|
| "Good evening, Shashank" | Hardcoded | `useAuthStore.user.fullName` + time-based greeting |
| `taskGroups` | Hardcoded 4 groups | `useTaskStore.loadMyTasks('dueDate')` → GET /api/v1/tasks?assigneeId=me&groupBy=dueDate |
| Recents card | Skeleton placeholders | `GET /api/v1/users/me/recently-viewed` (identity-service, recentlyViewedHandler) |
| Agenda card | Static connect buttons | Calendar integrations (P2, can remain static for now) |
| Done tab | No data | `GET /api/v1/tasks?assigneeId=me&status=done` |
| Delegated tab | No data | `GET /api/v1/tasks?assigneeId=me&delegated=true` |

---

### 11. Inbox (`src/components/views/inbox-view.tsx`)

| Element | Replace | With |
|---|---|---|
| `primaryNotifications` | 5 hardcoded | `useNotificationStore.loadNotifications('primary')` |
| `otherNotifications` | 2 hardcoded | `useNotificationStore.loadNotifications('other')` |
| Tab counts | Hardcoded "5", "2" | From API response length or `unread-count` endpoint |
| Mark as read | No handler | `useNotificationStore.markAsRead(id)` |
| Snooze | No handler | `useNotificationStore.snooze(id, until)` |
| Clear/archive | No handler | `useNotificationStore.clear(id)` |
| "Mark all as read" | No handler | `useNotificationStore.markAllAsRead()` |
| "Clear all" | No handler | `useNotificationStore.clearAll()` |
| Later tab | Empty | `GET /api/v1/notifications?snoozed=true` |
| Cleared tab | Empty | `GET /api/v1/notifications/cleared` |

**WebSocket:** Listen for `notification.send` on `user:${userId}` room.

---

### 12. Docs Hub (`src/components/views/docs-hub.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoDocs` | 3 hardcoded docs | `GET /api/v1/docs?workspaceId=X` (docs-service) |
| Sidebar filters | Static categories | Filter params on GET /api/v1/docs |
| Templates row | Static cards | `GET /api/v1/docs/templates` |
| "New Doc" | No handler | `POST /api/v1/docs` |
| "Import" | No handler | Import flow (P2) |
| Doc row click | No handler | `router.push(/docs/${docId})` → need doc editor page |
| Sort/Filter toolbar | No handler | Query params on GET /api/v1/docs |

---

### 13. Dashboards Hub (`src/components/views/dashboards-hub.tsx`)

| Element | Replace | With |
|---|---|---|
| `existingDashboards` | 1 hardcoded | `GET /api/v1/dashboards/workspaces/:workspaceId/dashboards` |
| Template cards | Static | `GET /api/v1/dashboards/dashboard-templates` |
| "New Dashboard" | No handler | `POST /api/v1/dashboards/workspaces/:workspaceId/dashboards` |
| Template click | No handler | `POST /api/v1/dashboards/workspaces/:workspaceId/dashboards/from-template/:templateId` |

---

### 14. Goals (`src/components/views/goals-view.tsx`)

| Element | Replace | With |
|---|---|---|
| Empty state | Always shown | Show if `GET /api/v1/goals/workspace/:workspaceId` returns empty array |
| "Set a Goal" | No handler | `POST /api/v1/goals` |
| "New Folder" | No handler | `POST /api/v1/goals/workspace/:workspaceId/goal-folders` |

---

### 15. Timesheets (`src/components/views/timesheets-view.tsx`)

| Element | Replace | With |
|---|---|---|
| `demoEntries` | Empty array | `GET /api/v1/tasks/time-entries/timesheet?userId=me&weekStart=YYYY-MM-DD` |
| "Track time" | No handler | Open timer → `POST /api/v1/tasks/:taskId/time-entries/timer/start` |
| "+ Add task" | No handler | Task picker → `POST /api/v1/tasks/:taskId/time-entries` |
| All timesheets tab | No data | Same endpoint without userId filter |
| Approvals tab | No data | Need approval workflow endpoints (P2) |

---

### 16. Settings (`src/components/views/settings-view.tsx`)

| Element | Replace | With |
|---|---|---|
| Profile fields | Local state with hardcoded values | `GET /api/v1/users/me` on mount |
| "Save changes" | No handler | `PATCH /api/v1/users/me` + `PATCH /api/v1/users/me/preferences` |
| Avatar change | No handler | `POST /api/v1/files` (upload) + `PATCH /api/v1/users/me` |
| Password change | No handler | `POST /api/v1/users/me/change-password` |
| 2FA toggles | Local state | `POST /api/v1/auth/2fa/enable` / `disable` |
| Theme color | Local state | `PATCH /api/v1/users/me/preferences` with `accentColor` |
| Appearance | Local state | `PATCH /api/v1/users/me/preferences` with `appearanceMode` |
| Non-Preferences pages | "Coming soon" | Wire each to its service endpoint (People→members, Teams→teams, etc.) |

---

### 17. Forms Hub (`src/components/views/forms-hub.tsx`)

| Element | Replace | With |
|---|---|---|
| Template cards | Static | `GET /api/v1/forms?workspaceId=X` or templates seed |
| "Your forms" | Empty state | `GET /api/v1/forms?workspaceId=X` |
| "New Form" / template click | No handler | `POST /api/v1/task-forms/lists/:listId/forms` |

---

### 18. Clips Hub (`src/components/views/clips-hub.tsx`)

| Element | Replace | With |
|---|---|---|
| Feature cards | Static | Keep static (P2 feature) |
| "Create Clip" | No handler | Browser MediaRecorder API → `POST /api/v1/files` for storage (P2) |

---

## Missing Frontend Pages (need page.tsx files)

| Route | Component Needed | Priority |
|---|---|---|
| `/login` | Login form (email/password) | P0 |
| `/register` | Registration form | P0 |
| `/my-tasks` | MyTasksView (already exists as component) | P0 |
| `/planner` | Calendar/planner view | P1 |
| `/ai` | AI chat interface | P1 |
| `/teams` | Teams hub | P1 |
| `/whiteboards` | Whiteboards hub | P2 |
| `/channels/[channelId]` | Chat channel view | P1 |
| `/docs/[docId]` | Doc editor (collaborative) | P1 |
| `/dashboards/[dashboardId]` | Dashboard view with widgets | P1 |

---

## Zustand Store Index

Create `apps/web/src/stores/index.ts`:
```typescript
export { useAuthStore } from './auth-store'
export { useWorkspaceStore } from './workspace-store'
export { useTaskStore } from './task-store'
export { useNotificationStore } from './notification-store'
export { useUIStore } from './ui-store'
```

---

## Environment Variables

Create `apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

---

## Wiring Checklist

For each component, the wiring pattern is:

```typescript
// 1. Import store
import { useTaskStore } from '@/stores/task-store'

// 2. Use store in component
const { tasks, isLoading, loadTasks } = useTaskStore()

// 3. Load data on mount
useEffect(() => { loadTasks(listId) }, [listId])

// 4. Replace hardcoded data with store data
// BEFORE: const demoTasks = [{ id: '1', title: 'Hardcoded' }]
// AFTER:  const tasks = useTaskStore(s => s.tasks)

// 5. Wire interactions to store methods
// BEFORE: onClick={() => {}} // no-op
// AFTER:  onClick={() => updateTask(taskId, { status: 'done' })}
```

### Order of wiring (recommended):
1. Create `/login` page → auth flow works
2. Wire `layout.tsx` → app loads real user/workspace
3. Wire `sidebar.tsx` → real spaces/lists/channels
4. Wire `list-view.tsx` + `board-view.tsx` → real tasks
5. Wire `task-detail.tsx` → real task CRUD
6. Wire `inbox-view.tsx` → real notifications
7. Wire remaining hubs (docs, dashboards, goals, settings, timesheets)
8. Add WebSocket listeners for real-time updates
