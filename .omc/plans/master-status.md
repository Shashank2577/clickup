# ClickUp OSS — Master Status
> Updated: 2026-04-24 — All feature branches merged to main; 19 packages build with zero TypeScript errors (Wave 4 complete)

---

## SERVICES MAP (14 microservices + gateway)

| Service | Port | Status | Key Features |
|---------|------|--------|-------------|
| **api-gateway** | 3000 | ✅ Complete | Proxy routing, auth forwarding, rate limiting, WebSocket server, **21 route prefixes** |
| **identity-service** | 3001 | ✅ Complete | Auth, users, workspaces, spaces, lists, folders, **user preferences**, **ClickApps toggle**, **favorites**, **recently viewed**, **API keys**, **saved searches**, **workspace invites**, **command palette**, password reset, email verification, audit log |
| **task-service** | 3002 | ✅ Complete | Task CRUD + subtasks, checklists, relations, watchers, time entries, custom fields, bulk ops, per-list statuses, activity log, templates, forms, recurring tasks, import/export CSV, **task duplication**, **multiple assignees**, **task archive/unarchive**, **share links**, **pinned tasks**, **task types**, **timesheets**, **checklist→task conversion**, **position reorder** |
| **comment-service** | 3003 | ✅ Complete | Comment CRUD, reactions, resolve, @mentions, threaded replies, **comment assignments** |
| **notification-service** | 3004 | ✅ Complete | In-app notifications, event-driven, email delivery (nodemailer), preferences, **daily digest scheduler** |
| **file-service** | 3005 | ✅ Complete | Upload/download/delete, MinIO S3 |
| **ai-service** | 3006 | ✅ Complete | Task breakdown, summarize, prioritize, daily-plan, **writing assistant (7 actions)**, **doc generation (6 types)**, **meeting notes extraction**, **smart task creation from text** |
| **automations-service** | 3007 | ✅ Complete | Rule CRUD, condition engine, action executor, run history |
| **search-service** | 3008 | ✅ Complete | Elasticsearch full-text, NATS indexing |
| **goals-service** | 3009 | ✅ Complete | Goal CRUD, OKR targets, progress tracking, **goal folders** |
| **docs-service** | 3010 | ✅ Complete | Doc CRUD, Y.js collab, 5-tier permissions, share links, version history (50 versions) |
| **views-service** | 3011 | ✅ Complete | View CRUD, per-user state, query engine (list/board/calendar/timeline/table/workload) |
| **webhooks-service** | 3012 | ✅ Complete | Outbound webhooks, HMAC delivery, retry, delivery history |
| **sprint-service** | 3013 | ✅ Complete | Sprint CRUD, start/complete lifecycle, task membership, burndown/velocity stats |
| **dashboard-service** | 3014 | ✅ Complete | Dashboard CRUD, 10 widget types with live SQL data computation |

---

## MIGRATIONS

| # | File | Tables |
|---|------|--------|
| 001 | initial.sql | users, sessions, workspaces, workspace_members, spaces, lists, tasks, task_watchers, task_tags, task_relations, checklists, checklist_items, comments, comment_reactions, docs, custom_fields, task_custom_fields, goals, goal_targets, time_entries, files, notifications, automations |
| 002 | research_improvements.sql | indexes, search improvements |
| 003 | add_password_hash.sql | password_hash column |
| 004 | doc_snapshots.sql | doc version snapshots |
| 005 | automation_runs.sql | automation run history |
| 006 | views.sql | saved views table |
| 007 | webhooks.sql | webhooks, webhook_deliveries |
| 008 | wave3_features.sql | folders, list_statuses, sprints, sprint_tasks, dashboards, dashboard_widgets, task_activity, task_templates, task_forms, form_submissions, recurring_task_configs, audit_logs, doc_permissions, doc_share_links, doc_versions, password_reset_tokens, email_verification_tokens, notification_preferences, api_keys, saved_searches |
| 009 | wave4_features.sql | task_assignees, user_preferences, workspace_clickapps, favorites, recently_viewed, comment_assignments, task_public_links, pinned_tasks, workspace_invites, task_types, guest_links, goal_folders |

---

## FEATURE COVERAGE vs REAL ClickUp

### Task Management ✅ ~98% complete
- [x] Create/edit/delete tasks
- [x] Subtasks (nested, materialized path)
- [x] Human-readable task IDs
- [x] Task version (optimistic locking)
- [x] Checklists + items (assignment, due date)
- [x] Tags
- [x] Watchers
- [x] Task relations (blocks/blocked_by/relates/duplicate)
- [x] Per-list custom statuses (CRUD + reorder)
- [x] Custom fields (14 types, workspace-scoped definitions)
- [x] Time tracking (manual, billable, reports, **timesheets**)
- [x] Recurring tasks (daily/weekly/monthly/cron)
- [x] Task templates (create from template)
- [x] Bulk update (status/priority/assignee/due on N tasks)
- [x] CSV import/export
- [x] JSON export
- [x] Activity log (per task)
- [x] Public intake forms (slug-based, no-auth submission)
- [x] Sprint points
- [x] Start date + due date
- [x] **Multiple assignees** (task_assignees table + CRUD endpoints)
- [x] **Task duplication** (POST /:taskId/duplicate)
- [x] **Task archival** (POST /:taskId/archive + unarchive)
- [x] **Task public share links** (shareable token-based URLs)
- [x] **Pinned tasks** (per list, per user)
- [x] **Custom task types** (Bug, Feature, Epic, etc.)
- [x] **Position reordering** (explicit drag-drop reorder)
- [x] **Checklist item → task conversion**
- [ ] Task email-to-create (inbound SMTP parsing)
- [ ] Multi-home tasks (mirrors in multiple lists)
- [ ] Task merge endpoint
- [ ] Formula / rollup custom field types

### Views ✅ ~90% complete
- [x] List view (SQL filter/sort/group engine)
- [x] Board/Kanban (grouped by status or custom field)
- [x] Calendar (date range + dateField bucketing)
- [x] Timeline (start_date + due_date range)
- [x] Table (column visibility config)
- [x] Workload (grouped by assignee + time totals)
- [x] Saved views with per-user state
- [x] Private vs shared views
- [x] Server-side filters (10 operators)
- [ ] Gantt chart (timeline extension, data exists)
- [ ] Mind map (not planned for v1)

### Collaboration ✅ ~95% complete
- [x] Comments (flat + threaded replies)
- [x] Comment reactions
- [x] Comment resolution
- [x] @Mentions (UUID parsing, NATS event)
- [x] **Comment assignments** (assign comment as action item to user)
- [x] In-app notifications (event-driven)
- [x] Email notifications (nodemailer, SMTP optional)
- [x] Notification preferences
- [x] **Notification email digest** (hourly background scheduler)
- [x] Real-time WebSocket (NATS → WS fan-out)
- [x] Doc collaborative editing (Y.js CRDT)
- [ ] Push notifications (mobile/browser)

### Docs ✅ ~95% complete
- [x] Rich text (Prosemirror JSON stored)
- [x] Nested pages (materialized path)
- [x] Real-time collaborative editing (Y.js)
- [x] 5-tier permission model (workspace → explicit → share link → public → deny)
- [x] Share links with token + role + expiry
- [x] 50-version history with restore
- [ ] Doc templates
- [ ] Embed tasks in docs

### Auth & Identity ✅ ~95% complete
- [x] Email/password register + login
- [x] JWT + refresh tokens
- [x] Password reset (email token flow)
- [x] Email verification
- [x] Workspace CRUD + member management
- [x] Space CRUD + privacy
- [x] List CRUD
- [x] Folder hierarchy (Space → Folder → List)
- [x] **Workspace member invites** (email invite + token accept)
- [x] **Guest links** (shareable workspace access)
- [x] **User preferences** (theme, timezone, date format, sidebar, density)
- [x] **Workspace ClickApps** (feature flag toggles per workspace)
- [x] **Favorites / Bookmarks** (tasks, docs, lists, spaces, etc.)
- [x] **Recently viewed** (last 20 items per workspace)
- [x] **API keys** (SHA-256 hashed, prefix-visible, scoped)
- [x] **Saved searches** (CRUD per user/workspace)
- [x] **Command palette** (quick search for spaces + lists)
- [ ] OAuth (Google/GitHub)
- [ ] 2FA/TOTP
- [ ] SSO/SAML
- [ ] SCIM provisioning

### Goals / OKRs ✅ ~95% complete
- [x] Goal CRUD
- [x] Targets (number/task/currency/boolean)
- [x] Progress auto-update on task.completed
- [x] **Goal folders** (hierarchical organization)
- [ ] Goal sharing/permissions

### AI Features ✅ ~90% complete
- [x] Task breakdown (create subtask tree from description)
- [x] Summarize task
- [x] Prioritize task list
- [x] Daily plan
- [x] **Writing assistant** (improve/shorten/expand/fix_grammar/make_formal/make_casual/translate)
- [x] **Doc generation** (spec/readme/meeting_notes/project_plan/retrospective/general)
- [x] **Meeting notes extraction** (summary/actionItems/decisions/topics)
- [x] **Smart task creation from text** (parse free-form text into structured tasks)
- [ ] AI-powered doc slash commands

### Automation ✅ ~80% complete
- [x] Rule CRUD (enable/disable)
- [x] Triggers: status change, field update, task created/assigned/completed, comment created
- [x] Actions: assign user, change status, add comment, send notification, create task
- [x] Automation run history
- [ ] Time-based (scheduled) triggers
- [ ] Webhook action (outbound HTTP from automation)
- [ ] Multi-step automation branching

### Dashboards ✅ ~80% complete
- [x] Dashboard CRUD (private/shared)
- [x] Widget layout (x/y/width/height)
- [x] task_count, task_by_status, task_by_assignee, task_by_priority
- [x] completion_rate, time_tracked, time_by_user, billable_time
- [x] overdue_tasks, custom_text, embed
- [ ] velocity, burndown, cumulative_flow (placeholders — sprint data needed)
- [ ] goals_progress, recent_activity widgets

### Sprints ✅ ~90% complete
- [x] Sprint CRUD
- [x] Sprint lifecycle (planning → active → completed)
- [x] Task membership (add/remove)
- [x] Burndown chart data (daily remaining points)
- [x] Velocity stats
- [ ] Backlog management view
- [ ] Sprint capacity planning

### Search ✅ ~75% complete
- [x] Full-text search (Elasticsearch)
- [x] Filter by workspace/list/type
- [x] Real-time NATS indexing
- [x] **Saved searches** (CRUD via identity-service)
- [x] **Command palette** (quick navigation search)
- [ ] Autocomplete/suggestions
- [ ] Search analytics

### Timesheets ✅ ~90% complete
- [x] Time entries (per task, start/stop, duration)
- [x] **Timesheet aggregation** (GET /time-entries/timesheet?groupBy=user|date)
- [x] Billable time tracking
- [ ] Timesheet export (CSV)

### Import/Export ✅ ~60% complete
- [x] CSV import (task-service)
- [x] CSV export
- [x] JSON export
- [ ] Jira import
- [ ] Trello import
- [ ] Markdown export (docs)

### Integrations ❌ 0% (Wave 5)
- [ ] Slack (OAuth + slash commands + notifications)
- [ ] GitHub (OAuth + PR/commit linking)
- [ ] Public REST API (API key auth middleware in gateway)

### Security & Enterprise ❌ 5% (Wave 5)
- [x] API key management (creation, hashing, scopes)
- [x] Workspace audit log (schema + endpoint done)
- [ ] API key auth in gateway middleware
- [ ] SSO/SAML 2.0
- [ ] SCIM provisioning
- [ ] Granular task-level permissions
- [ ] Guest user flows (table exists, no handler)
- [ ] OWASP security audit

---

## API SURFACE OVERVIEW

### Identity Service routes (port 3001)
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/verify
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/verify-email
POST   /auth/resend-verification

GET    /users/me
PATCH  /users/me
GET    /users/preferences
PUT    /users/preferences

GET    /workspaces
POST   /workspaces
GET    /workspaces/:id
PATCH  /workspaces/:id
GET    /workspaces/:id/members
POST   /workspaces/:id/members
PATCH  /workspaces/:id/members/:userId
DELETE /workspaces/:id/members/:userId
GET    /workspaces/:id/spaces
POST   /workspaces/:id/spaces
GET    /workspaces/:id/audit-log
GET    /workspaces/:id/clickapps
PUT    /workspaces/:id/clickapps
GET    /workspaces/:id/favorites
POST   /workspaces/:id/favorites
DELETE /workspaces/:id/favorites/:id
PATCH  /workspaces/:id/favorites/reorder
GET    /workspaces/:id/recently-viewed
POST   /workspaces/:id/recently-viewed
GET    /workspaces/:id/api-keys
POST   /workspaces/:id/api-keys
DELETE /workspaces/:id/api-keys/:id
PATCH  /workspaces/:id/api-keys/:id
GET    /workspaces/:id/saved-searches
POST   /workspaces/:id/saved-searches
PATCH  /workspaces/:id/saved-searches/:id
DELETE /workspaces/:id/saved-searches/:id
GET    /workspaces/:id/invites
POST   /workspaces/:id/invites
DELETE /workspaces/:id/invites/:id

POST   /invites/accept

GET    /command-palette?q=&workspaceId=

GET    /spaces/:id
PATCH  /spaces/:id
DELETE /spaces/:id
GET    /spaces/:id/folders
POST   /spaces/:id/folders
GET    /spaces/:id/lists
POST   /spaces/:id/lists

GET    /folders/:id
PATCH  /folders/:id
DELETE /folders/:id
GET    /folders/:id/lists
POST   /folders/:id/lists

GET    /lists/:id
PATCH  /lists/:id
DELETE /lists/:id
```

### Task Service routes (port 3002)
```
POST   /tasks
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
GET    /tasks/list/:listId
POST   /tasks/:id/archive
POST   /tasks/:id/unarchive
POST   /tasks/:id/duplicate
GET    /tasks/:id/assignees
POST   /tasks/:id/assignees
DELETE /tasks/:id/assignees/:userId
GET    /tasks/:id/relations
POST   /tasks/:id/relations
DELETE /tasks/:id/relations/:relationId
GET    /tasks/:id/watchers
POST   /tasks/:id/watchers
DELETE /tasks/:id/watchers/:userId
GET    /tasks/:id/checklists
POST   /tasks/:id/checklists
GET    /tasks/:id/time-entries
POST   /tasks/:id/time-entries
GET    /tasks/:id/custom-fields
POST   /tasks/:id/custom-fields/:fieldId
GET    /tasks/:id/activity
GET    /tasks/:id/recurring
PUT    /tasks/:id/recurring
PATCH  /tasks/:id/recurring
DELETE /tasks/:id/recurring
POST   /tasks/:id/share
GET    /tasks/:id/share
DELETE /tasks/:id/share
POST   /tasks/:id/pin
DELETE /tasks/:id/pin
POST   /tasks/:id/archive
POST   /tasks/:id/unarchive
GET    /tasks/share/:token (public)
POST   /tasks/import/csv
GET    /tasks/export/csv
GET    /tasks/export/json
GET    /tasks/time-entries/timesheet
GET    /tasks/lists/:listId/pinned
PATCH  /tasks/lists/:listId/tasks/reorder
PATCH  /tasks/lists/:listId/statuses/reorder
POST   /tasks/bulk-update
GET    /tasks/checklist-items/:id
PATCH  /tasks/checklist-items/:id
DELETE /tasks/checklist-items/:id
POST   /tasks/checklist-items/:id/convert

GET    /custom-fields/:workspaceId
POST   /custom-fields/:workspaceId
PATCH  /custom-fields/:workspaceId/:fieldId
DELETE /custom-fields/:workspaceId/:fieldId

GET    /list-statuses/:listId
POST   /list-statuses/:listId
PATCH  /list-statuses/:listId/:statusId
DELETE /list-statuses/:listId/:statusId

GET    /task-templates/:workspaceId
POST   /task-templates/:workspaceId
PATCH  /task-templates/:workspaceId/:templateId
DELETE /task-templates/:workspaceId/:templateId
POST   /task-templates/:workspaceId/:templateId/use

GET    /task-types/:workspaceId
POST   /task-types/:workspaceId
PATCH  /task-types/:workspaceId/:id
DELETE /task-types/:workspaceId/:id

GET    /task-forms/:listId
POST   /task-forms/:listId

GET    /forms/:formId
PATCH  /forms/:formId
DELETE /forms/:formId
POST   /forms/submit/:slug (public)
GET    /forms/:formId/submissions
```

### AI Service routes (port 3006)
```
POST   /ai/breakdown
POST   /ai/summarize
POST   /ai/prioritize
POST   /ai/daily-plan
POST   /ai/writing-assistant
POST   /ai/doc-generate
POST   /ai/meeting-notes
POST   /ai/smart-tasks
```

---

## REMAINING WAVE 5 WORK

Priority order:
1. **API key auth in gateway** — middleware to accept `Authorization: Bearer cu_...` and forward user context
2. **OAuth Google/GitHub** — passport.js + identity-service handlers
3. **Slack integration** — OAuth + webhook + slash commands (new service)
4. **GitHub integration** — PR/commit linking via webhooks (new service)
5. **Jira import** — parse Jira JSON export into tasks/checklists
6. **Trello import** — parse Trello JSON export
7. **OpenAPI spec** — auto-generate from contracts + route definitions
8. **SSO/SAML** — enterprise IdP integration
9. **SCIM provisioning** — enterprise user sync
10. **Multi-home tasks** — task_mirrors table for tasks appearing in multiple lists
11. **Gantt chart** — extend timeline view with dependency lines
12. **k8s/Helm manifests** — production deployment
13. **Whiteboard service** — tldraw-based collaborative whiteboard (port 3015)
