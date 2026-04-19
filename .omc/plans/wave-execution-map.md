# Wave Execution Map — ClickUp OSS
## Master Schedule for 300 Parallel Jules Sessions

**Total work orders:** 121
**Estimated sessions needed:** ~180 (some WOs run parallel within service)
**Daily capacity:** 300 sessions → fits in 1 aggressive day

**Rule:** Each wave is fully parallel internally.
Next wave does NOT start until current wave is merged + CI green.

---

## WAVE 0 — Foundation (1 session, DONE)
*Must complete before anything else. You + Claude. No Jules.*

| WO | Branch | What | Blocks |
|----|--------|------|--------|
| WO-000 | `wave0/foundation` | Contracts pkg, SDK pkg, DB migrations 001+002, Docker Compose, CI pipeline, service template | ALL |

**Status: COMPLETE ✅**

---

## WAVE 1 — Infrastructure Layer (~12 sessions, fully parallel)
*Core services all other services depend on. Merge all before Wave 2.*

### Identity Service (4 sessions — parallel internally)

| WO | Branch | What | Files |
|----|--------|------|-------|
| WO-001 | `wave1/identity-auth` | Register, login, logout, JWT sign/verify, session table CRUD | `identity-service/src/auth/` |
| WO-002 | `wave1/identity-users` | User profile CRUD, avatar upload, password change | `identity-service/src/users/` |
| WO-003 | `wave1/identity-workspaces` | Workspace CRUD, member invite/remove/role-change, workspace members list | `identity-service/src/workspaces/` |
| WO-004 | `wave1/identity-spaces-lists` | Space CRUD, List CRUD, space members (private spaces) | `identity-service/src/spaces/`, `identity-service/src/lists/` |

**WO-001 dependency:** none
**WO-002,003,004 dependency:** WO-001 (need user entity from auth)

### API Gateway (2 sessions — sequential within gateway)

| WO | Branch | What | Files |
|----|--------|------|-------|
| WO-005 | `wave1/gateway-routing` | Express proxy routing to all services, correlation ID, auth header forwarding, health aggregation | `api-gateway/src/routes/`, `api-gateway/src/proxy/` |
| WO-006 | `wave1/gateway-websocket` | WebSocket server, room join/leave (from contracts/rooms.ts), NATS→WS fan-out, reconnect replay | `api-gateway/src/websocket/` |

**WO-005 dependency:** WO-000
**WO-006 dependency:** WO-005

### Infrastructure Sessions (3 sessions — fully parallel)

| WO | Branch | What | Files |
|----|--------|------|-------|
| WO-007 | `wave1/db-seed` | Seed script: default task statuses per list, test workspace/user fixtures | `infra/seeds/` |
| WO-008 | `wave1/pact-broker` | Pact broker Docker setup, contract test runner, CI integration | `infra/pact/` |
| WO-009 | `wave1/test-helpers` | Shared test utilities: DB setup/teardown, auth token factory, request factory, fixture builders | `packages/test-helpers/` |

**All WO-007,008,009:** depend only on WO-000

### Wave 1 Gate
```
All 9 work orders merged + CI green before Wave 2 starts.
Smoke test: docker-compose up → all /health endpoints return 200.
```

---

## WAVE 2 — Core Services (~70 sessions, fully parallel)
*Every service in Wave 2 is independent. All can run simultaneously.*

### Task Service (6 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-010 | `wave2/task-core` | Task CRUD + hierarchy + materialized path + seq_id + version | POST/GET/PATCH/DELETE /tasks, GET /lists/:id/tasks |
| WO-011 | `wave2/task-checklists` | Checklists + checklist items CRUD | POST/GET/PATCH/DELETE /tasks/:id/checklists, /checklists/:id/items |
| WO-012 | `wave2/task-relations` | Task relations (blocks, relates, duplicate), tags, watchers | POST/DELETE /tasks/:id/relations, /tags, /watchers |
| WO-013 | `wave2/task-statuses` | Per-list task statuses CRUD + default seeding | POST/GET/PATCH/DELETE /lists/:id/statuses |
| WO-014 | `wave2/task-custom-fields` | Custom field schema CRUD + task field values CRUD | POST/GET/PATCH/DELETE /workspaces/:id/fields, /tasks/:id/fields |
| WO-015 | `wave2/task-time-tracking` | Time entries CRUD, billable toggle, total time rollup | POST/GET/PATCH/DELETE /tasks/:id/time-entries |

**All depend on:** WO-001 (identity), WO-009 (test-helpers)
**WO-011,012,013,014,015 depend on:** WO-010 (task core must exist)
**Note:** WO-011 through WO-015 can run in parallel after WO-010 merges

### Comment Service (2 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-020 | `wave2/comment-core` | Comment CRUD, reactions, threaded replies | POST/GET/PATCH/DELETE /tasks/:id/comments, /comments/:id/reactions |
| WO-021 | `wave2/comment-mentions` | Mention parsing (@user), comment resolution, publishes CommentCreatedEvent with mentionedUserIds | Extends WO-020 |

**WO-020 depends on:** WO-001, WO-009
**WO-021 depends on:** WO-020

### Docs Service (3 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-022 | `wave2/docs-core` | Doc CRUD, nested pages with materialized path, public sharing | POST/GET/PATCH/DELETE /docs |
| WO-023 | `wave2/docs-realtime` | Y.js Hocuspocus integration for real-time collaborative editing of doc body | WebSocket /docs/:id/collaborate |
| WO-024 | `wave2/docs-permissions` | Doc-level read/write permissions, guest access, public link generation | POST/GET /docs/:id/permissions |

**WO-022 depends on:** WO-001, WO-009
**WO-023,024 depend on:** WO-022

### AI Service (3 sessions — parallel after WO-025)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-025 | `wave2/ai-infrastructure` | Claude API client, retry logic, rate limiting, failure mode handling (all 6 failure scenarios from plan), base prompt builder | `ai-service/src/llm/` |
| WO-026 | `wave2/ai-task-breakdown` | Task breakdown capability: natural language → structured tasks + subtasks | POST /ai/task-breakdown |
| WO-027 | `wave2/ai-summarize-prioritize` | Summarize (task/doc/thread), prioritize tasks, AI_UNAVAILABLE degradation | POST /ai/summarize, POST /ai/prioritize |
| WO-028 | `wave2/ai-daily-plan` | Daily plan generation: capacity-aware, overload detection | POST /ai/daily-plan |

**WO-025 depends on:** WO-000, WO-009
**WO-026,027,028 depend on:** WO-025 (AI infrastructure must exist)
**Note:** WO-026,027,028 fully parallel after WO-025

### File Service (2 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-030 | `wave2/file-upload` | MinIO integration, file upload (multipart), metadata storage, file size + type validation | POST /files |
| WO-031 | `wave2/file-download` | Presigned URL generation for download/preview, file delete, thumbnail support | GET /files/:id, DELETE /files/:id |

**All depend on:** WO-001, WO-009
**WO-031 depends on:** WO-030

### Notification Service (3 sessions)

| WO | Branch | What | Events Consumed |
|----|--------|------|-----------------|
| WO-033 | `wave2/notification-core` | Notification entity CRUD, mark-as-read, mark-all-read, list notifications paginated | GET/PATCH /notifications |
| WO-034 | `wave2/notification-events` | NATS event consumers: task.assigned, task.completed, comment.created, comment.resolved, workspace.member_added → creates notification rows | Subscribes to 8 events |
| WO-035 | `wave2/notification-email` | Email delivery via nodemailer/SMTP, email templates per notification type, unsubscribe handling | Extends WO-034 |

**WO-033 depends on:** WO-001, WO-009
**WO-034 depends on:** WO-033
**WO-035 depends on:** WO-034

### Search Service (3 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-036 | `wave2/search-infrastructure` | ElasticSearch client, index creation (tasks, docs, comments), mapping definitions | `search-service/src/indices/` |
| WO-037 | `wave2/search-indexing` | NATS event consumers: task.created/updated/deleted, doc.created/updated, comment.created → indexes to ES | Subscribes to 8 events |
| WO-038 | `wave2/search-api` | Search endpoint: full-text + workspace scoping + type filter + pagination | GET /search?q=&type=&workspaceId= |

**WO-036 depends on:** WO-000, WO-009
**WO-037 depends on:** WO-036
**WO-038 depends on:** WO-036

### Goal Service (2 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-040 | `wave2/goal-core` | Goal CRUD, goal target CRUD (number/boolean/task types) | POST/GET/PATCH/DELETE /workspaces/:id/goals |
| WO-041 | `wave2/goal-progress` | Progress calculation, task-linked target auto-update on task.completed, publishGoalProgressEvent | Subscribes to task.completed |

**WO-040 depends on:** WO-001, WO-009
**WO-041 depends on:** WO-040

### Recurring Tasks (1 session)

| WO | Branch | What | What it does |
|----|--------|------|-------------|
| WO-042 | `wave2/task-recurring` | Recurring task config (cron expression per task), background job that creates next instance on completion | Cron job + task-service HTTP call |

**Depends on:** WO-010 (task core)

### Wave 2 Summary
```
Total WOs: 30
Truly parallel (can all run simultaneously): WO-010, WO-020, WO-022, WO-025,
  WO-030, WO-033, WO-036, WO-040
Within-service sequential: WO-011→010, WO-021→020, WO-023→022, etc.

Estimated wall time: 2–3 hours
(longest chain: WO-025 → WO-026/027/028, each ~1–1.5 hours)

Wave 2 Gate: All 30 WOs merged + CI green.
Integration smoke test: create workspace, create task, AI breaks it down,
search finds it, notification delivered.
```

---

## WAVE 3 — Cross-Feature Layer (~35 sessions)
*Features that span multiple Wave 2 services. Fully parallel within wave.*

### View Service (7 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-050 | `wave3/view-core` | View CRUD (workspace + list scoped), view config JSONB, per-user state | POST/GET/PATCH/DELETE /views |
| WO-051 | `wave3/view-list` | List view: server-side FilterGroup→SQL, sort, grouping, pagination | GET /views/:id/tasks (list type) |
| WO-052 | `wave3/view-board` | Kanban board: groupByPropertyId bucketing, column ordering, drag position | GET /views/:id/tasks (board type) |
| WO-053 | `wave3/view-calendar` | Calendar view: date property bucketing, date range query | GET /views/:id/tasks (calendar type) |
| WO-054 | `wave3/view-timeline` | Timeline view: start_date + due_date range rendering data | GET /views/:id/tasks (timeline type) |
| WO-055 | `wave3/view-table` | Table view: column visibility, column widths, multi-property display | GET /views/:id/tasks (table type) |
| WO-056 | `wave3/view-workload` | Workload view: tasks grouped by assignee + date, capacity calculation | GET /views/:id/workload |

**All depend on:** WO-010 (tasks), WO-001 (identity)
**WO-051→056 depend on:** WO-050 (view core)

### Automation Service (4 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-060 | `wave3/automation-core` | Automation rule CRUD, enable/disable | POST/GET/PATCH/DELETE /workspaces/:id/automations |
| WO-061 | `wave3/automation-triggers` | NATS consumers for all trigger types, condition evaluation engine | Subscribes to task.*, comment.created |
| WO-062 | `wave3/automation-actions` | Action execution: assign user, change status, add comment, send notification, update field | Internal execution engine |
| WO-063 | `wave3/automation-webhook` | Webhook action: HTTP POST to external URL with task payload, retry on failure | External HTTP calls |

**WO-060 depends on:** WO-001, WO-009
**WO-061,062,063 depend on:** WO-060

### Dashboard Service (4 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-065 | `wave3/dashboard-core` | Dashboard CRUD, widget layout (JSONB positions) | POST/GET/PATCH/DELETE /workspaces/:id/dashboards |
| WO-066 | `wave3/dashboard-task-widgets` | Task count, task by status, task by assignee, completion rate widgets | GET /dashboards/:id/widgets/tasks |
| WO-067 | `wave3/dashboard-time-widgets` | Time tracked by user, time by project, billable vs non-billable widgets | GET /dashboards/:id/widgets/time |
| WO-068 | `wave3/dashboard-sprint-widgets` | Velocity chart, burndown chart, cumulative flow widgets | GET /dashboards/:id/widgets/sprint |

**WO-065 depends on:** WO-001, WO-009
**WO-066,067,068 depend on:** WO-065 + relevant Wave 2 services

### Sprints (Agile) (2 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-070 | `wave3/sprints-core` | Sprint CRUD, sprint points, start/complete sprint | POST/GET/PATCH /lists/:id/sprints |
| WO-071 | `wave3/sprints-backlog` | Backlog management, move tasks to/from sprint, sprint capacity | PATCH /sprints/:id/tasks |

**Depends on:** WO-010 (tasks)

### Advanced Task Features (5 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-073 | `wave3/task-templates` | Task templates CRUD, create task from template | POST/GET /workspaces/:id/task-templates |
| WO-074 | `wave3/task-bulk` | Bulk update (status/assignee/priority on N tasks), bulk delete | POST /tasks/bulk-update, /tasks/bulk-delete |
| WO-075 | `wave3/task-email` | Inbound email → task creation (parse SMTP, create task via task-service) | Email webhook handler |
| WO-076 | `wave3/task-activity-log` | Per-task activity log (all mutations recorded), paginated activity feed | GET /tasks/:id/activity |
| WO-077 | `wave3/task-forms` | Public form CRUD, conditional field logic, form submission → task creation | POST/GET /lists/:id/forms |

**All depend on:** WO-010 (tasks)

### Permissions & Security (3 sessions)

| WO | Branch | What | What it does |
|----|--------|------|-------------|
| WO-079 | `wave3/permissions-granular` | Task-level permissions (viewer/editor override), field-level permissions on custom fields | Extends identity-service permission checks |
| WO-080 | `wave3/permissions-guest` | Guest user flows: invite by link, scoped access (read-only or comment-only) | Extends WO-003 |
| WO-081 | `wave3/audit-log` | Workspace-level audit log: all mutations with actor, action, before/after values | GET /workspaces/:id/audit-log |

**All depend on:** WO-001, WO-003

### Wave 3 Summary
```
Total WOs: 29
Fully parallel: WO-050, WO-060, WO-065, WO-070, WO-073, WO-079
Within-service sequential chains as above.

Wave 3 Gate: All 29 WOs merged + CI green.
Integration smoke test: create automation that fires on status change →
  verifies notification delivered + dashboard widget updates.
```

---

## WAVE 4 — Polish, Integrations & Production Hardening (~35 sessions)

### Integrations (4 sessions — parallel)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-085 | `wave4/integration-slack` | Slack OAuth, slash commands, task notification to Slack channel | POST /integrations/slack |
| WO-086 | `wave4/integration-github` | GitHub OAuth, link PR/commit to task, auto status change on PR merge | POST /integrations/github |
| WO-087 | `wave4/webhooks-outbound` | User-defined outbound webhooks: any event type → HTTP POST to URL | POST/GET /workspaces/:id/webhooks |
| WO-088 | `wave4/public-api` | Public REST API: rate limiting, API key management, usage tracking | POST /api-keys |

**All depend on:** Wave 3 complete

### Data Management (4 sessions — parallel)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-090 | `wave4/import-csv` | CSV import for tasks (map columns to task fields, bulk create) | POST /workspaces/:id/import/csv |
| WO-091 | `wave4/import-jira` | Jira JSON export → task hierarchy import | POST /workspaces/:id/import/jira |
| WO-092 | `wave4/import-trello` | Trello JSON export → lists + cards import | POST /workspaces/:id/import/trello |
| WO-093 | `wave4/export` | Export tasks to CSV/JSON, export docs to Markdown | GET /workspaces/:id/export |

### Advanced Search & Global Features (3 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-095 | `wave4/search-advanced` | Saved searches, search across workspace (tasks + docs + comments unified), fuzzy matching | GET /search/saved |
| WO-096 | `wave4/command-palette-api` | API for global search results structured for command palette (recent items, quick actions) | GET /command-palette?q= |
| WO-097 | `wave4/global-activity` | Workspace-level activity feed (all changes across all projects, paginated) | GET /workspaces/:id/activity |

### Enterprise Features (3 sessions)

| WO | Branch | What | Endpoints |
|----|--------|------|-----------|
| WO-099 | `wave4/sso-saml` | SAML 2.0 SSO integration: identity provider metadata, assertion consumer | POST /auth/saml |
| WO-100 | `wave4/scim` | SCIM 2.0 user provisioning: auto-create/update/deactivate users from IdP | /scim/v2/Users |
| WO-101 | `wave4/multi-language` | i18n infrastructure: locale detection, translation key management | GET /i18n/:locale |

### Integration Tests (6 sessions — parallel)

| WO | Branch | What |
|----|--------|------|
| WO-105 | `wave4/test-e2e-auth` | E2E: register → invite member → login as member → verify access |
| WO-106 | `wave4/test-e2e-task-flow` | E2E: create workspace → list → task → subtask → comment → AI breakdown → search finds it |
| WO-107 | `wave4/test-e2e-automation` | E2E: create automation → trigger → verify action fired + notification delivered |
| WO-108 | `wave4/test-e2e-views` | E2E: create list view → apply filter → verify SQL filter returns correct tasks |
| WO-109 | `wave4/test-contract-suite` | Run all Pact consumer contracts against all providers, generate compatibility matrix |
| WO-110 | `wave4/test-performance` | k6 load test: 1000 concurrent users, task list endpoint < 200ms p95 |

### Documentation & Deployment (5 sessions — parallel)

| WO | Branch | What |
|----|--------|------|
| WO-113 | `wave4/api-docs` | Auto-generate OpenAPI HTML docs from contract specs, host at /api-docs |
| WO-114 | `wave4/k3s-manifests` | Complete k3s production manifests: all services, ingress, TLS, resource limits |
| WO-115 | `wave4/docker-compose-prod` | Production docker-compose with Traefik reverse proxy, Let's Encrypt SSL |
| WO-116 | `wave4/helm-chart` | Helm chart for k8s deployment (alternative to k3s manifests) |
| WO-117 | `wave4/self-host-docs` | Self-hosting guide: one-command setup, config reference, bring-your-own-LLM-key setup |

### Security Hardening (3 sessions — parallel)

| WO | Branch | What |
|----|--------|------|
| WO-119 | `wave4/security-input-sanitization` | HTML sanitization on all user content, XSS prevention, content security policy headers |
| WO-120 | `wave4/security-rate-limits` | Per-endpoint rate limits, abuse detection, IP-level blocking |
| WO-121 | `wave4/security-audit` | OWASP top 10 audit: SQL injection, auth bypass, IDOR tests, fix any issues found |

### Wave 4 Summary
```
Total WOs: 33
All fully parallel within wave (no internal dependencies).

Wave 4 Gate: All 33 WOs merged + CI green.
Final check: self-hosting guide works end-to-end on fresh machine.
```

---

## Complete Summary

| Wave | Sessions | Wall Time | What Gets Built |
|------|----------|-----------|-----------------|
| Wave 0 | 1 | Day 0 | Foundation — contracts, SDK, schema, CI |
| Wave 1 | 12 | ~2 hours | Auth, gateway, infra services |
| Wave 2 | 30 | ~3 hours | All core feature services |
| Wave 3 | 29 | ~3 hours | Cross-feature: views, automation, dashboards |
| Wave 4 | 33 | ~3 hours | Polish, integrations, tests, deployment |
| **Total** | **105** | **~11 hours** | **Full product** |

With 300 Jules sessions available: **comfortable margin for reruns and fixes.**

---

## Feature Coverage Map

Every ClickUp feature from the original inventory mapped to a WO:

### Task System (30 features)
| Feature | WO |
|---------|-----|
| Create/edit/delete tasks | WO-010 |
| Subtasks (nested, any depth) | WO-010 |
| Materialized path tree queries | WO-010 |
| Human-readable task IDs (LIST-42) | WO-010 |
| Task version (optimistic locking) | WO-010 |
| Checklists (multi-level) | WO-011 |
| Checklist item assignment + due date | WO-011 |
| Tags | WO-012 |
| Watchers | WO-012 |
| Task relations (blocks/relates/duplicate) | WO-012 |
| Per-list custom statuses + groups | WO-013 |
| Custom fields (all 14 types) | WO-014 |
| Custom field values on tasks | WO-014 |
| Time tracking (manual + timer) | WO-015 |
| Billable vs non-billable time | WO-015 |
| Recurring tasks (cron-based) | WO-042 |
| Task templates | WO-073 |
| Bulk task operations | WO-074 |
| Email → task | WO-075 |
| Task activity log | WO-076 |
| Public forms → task creation | WO-077 |
| Task-level permissions | WO-079 |
| Multiple assignees | WO-010 (config in schema) |
| Sprint points | WO-010 |
| Start date + due date | WO-010 |
| Task dependencies (blocking/waiting) | WO-012 |
| Task merging | WO-074 (bulk ops) |
| Task version history | WO-076 (activity log) |
| Rich description (Prosemirror JSON) | WO-010 |
| Mentions in tasks | WO-021 |

### Views System (20 features)
| Feature | WO |
|---------|-----|
| List view | WO-051 |
| Kanban board | WO-052 |
| Calendar view | WO-053 |
| Timeline view | WO-054 |
| Table view (spreadsheet-like) | WO-055 |
| Workload view | WO-056 |
| Server-side filters | WO-051 |
| Multi-level sort | WO-051 |
| Grouping (status/assignee/field) | WO-052 |
| Saved views | WO-050 |
| Private vs public views | WO-050 |
| Per-user view state (collapsed groups) | WO-050 |
| Column widths | WO-055 |
| View-level card ordering | WO-050 |
| Workspace-level views | WO-050 |
| View permissions | WO-050 |
| View sharing | WO-050 |
| Gantt view | WO-054 (timeline extension) |
| Activity view | WO-097 (global activity) |
| Mind map | Phase 2 (not in v1) |

### AI Features (8 features)
| Feature | WO |
|---------|-----|
| Natural language → task breakdown | WO-026 |
| Task summarization | WO-027 |
| Comment thread summarization | WO-027 |
| Doc summarization | WO-027 |
| AI task prioritization | WO-027 |
| AI daily planner | WO-028 |
| AI graceful degradation | WO-025 |
| Bring-your-own-API-key | WO-117 |

### Collaboration (10 features)
| Feature | WO |
|---------|-----|
| Comments (threaded) | WO-020 |
| Comment reactions | WO-020 |
| Comment resolution | WO-021 |
| @Mentions | WO-021 |
| In-app notifications | WO-033,034 |
| Email notifications | WO-035 |
| Notification preferences | WO-035 |
| Real-time updates (WebSocket) | WO-006 |
| Activity feed | WO-076,097 |
| Inbox system | WO-033 |

### Docs (12 features)
| Feature | WO |
|---------|-----|
| Rich text editor (Prosemirror) | WO-022 |
| Nested pages | WO-022 |
| Real-time collaborative editing | WO-023 |
| Comments on docs | WO-020 (extend) |
| Doc version history | WO-022 |
| Doc permissions | WO-024 |
| Public sharing | WO-024 |
| Doc templates | Phase 2 |
| Embed tasks in docs | Phase 2 |
| Wiki mode | WO-022 |
| Search in docs | WO-037 |
| Slash commands | WO-022 |

### Automation (15 features)
| Feature | WO |
|---------|-----|
| Rule builder (no-code) | WO-060 |
| Status change trigger | WO-061 |
| Field update trigger | WO-061 |
| Time-based trigger | WO-061 |
| Assign user action | WO-062 |
| Change status action | WO-062 |
| Add comment action | WO-062 |
| Send notification action | WO-062 |
| Webhook action | WO-063 |
| Create task action | WO-062 |
| Automation templates | WO-060 |
| Multi-step automations | WO-062 |
| Automation run count/history | WO-060 |
| Enable/disable rules | WO-060 |
| Automation rate limiting | WO-061 |

### Dashboards & Reporting (12 features)
| Feature | WO |
|---------|-----|
| Custom dashboards | WO-065 |
| Task count widgets | WO-066 |
| Task by status chart | WO-066 |
| Task by user chart | WO-066 |
| Time tracking widgets | WO-067 |
| Sprint velocity | WO-068 |
| Burndown chart | WO-068 |
| Burnup chart | WO-068 |
| Cumulative flow | WO-068 |
| Goal progress tracking | WO-040,041 |
| Sprint management | WO-070,071 |
| Exporting | WO-093 |

### Permissions & Security (10 features)
| Feature | WO |
|---------|-----|
| Owner/Admin/Member/Guest roles | WO-001,003 |
| Space-level permissions | WO-004 |
| List-level access | WO-004 |
| Task-level permissions | WO-079 |
| Field-level permissions | WO-079 |
| Guest access | WO-080 |
| Public/private spaces | WO-004 |
| SSO/SAML | WO-099 |
| SCIM provisioning | WO-100 |
| Audit logs | WO-081 |

### Integrations & API (12 features)
| Feature | WO |
|---------|-----|
| Slack integration | WO-085 |
| GitHub integration | WO-086 |
| Outbound webhooks | WO-087 |
| Public REST API | WO-088 |
| API key management | WO-088 |
| Zapier (via webhooks) | WO-087 |
| CSV import | WO-090 |
| Jira import | WO-091 |
| Trello import | WO-092 |
| Data export | WO-093 |
| OAuth 2.0 | WO-088 |
| Rate limiting on API | WO-120 |

### Advanced / Hidden Features (15 features)
| Feature | WO |
|---------|-----|
| Global search | WO-038,095 |
| Command palette API | WO-096 |
| Saved searches | WO-095 |
| Recently viewed | WO-096 |
| Global activity log | WO-097 |
| Workspace-level audit log | WO-081 |
| Self-hosting guide | WO-117 |
| Dark mode support | WO-101 (config flag) |
| Multi-language | WO-101 |
| Mobile API optimization | WO-114 (k3s CDN config) |
| Full-text search (task + doc + comment) | WO-036,037,038 |
| Security hardening | WO-119,120,121 |
| Performance testing | WO-110 |
| Health monitoring endpoints | WO-000 (SDK) |
| Bring-your-own-LLM-key | WO-025,117 |

---

## Dependency Graph (Critical Path)

```
WO-000 (Wave 0)
  ├── WO-001 (auth) ──────────────────────────────────────────┐
  │     ├── WO-002 (users)                                    │
  │     ├── WO-003 (workspaces)                               │
  │     └── WO-004 (spaces+lists)                             │
  ├── WO-005 (gateway-routing) → WO-006 (websocket)           │
  ├── WO-007 (db-seed)                                        │
  ├── WO-008 (pact-broker)                                    │
  └── WO-009 (test-helpers) ──────────────────────────────────┤
                                                              ↓
                                              WO-010 (task-core) ←── critical path
                                                ├── WO-011 (checklists)
                                                ├── WO-012 (relations)
                                                ├── WO-013 (statuses)
                                                ├── WO-014 (custom fields)
                                                └── WO-015 (time tracking)

WO-025 (ai-infra) → WO-026, WO-027, WO-028 (parallel)

[All Wave 2] → [All Wave 3] → [All Wave 4]
```

**Critical path (longest chain):**
`WO-000 → WO-001 → WO-009 → WO-025 → WO-026`
Estimated: ~5 hours end-to-end

---

## Work Order Index

Quick reference — all 105 WOs:

```
WAVE 1 (12):  WO-001 through WO-009
WAVE 2 (30):  WO-010 through WO-042
WAVE 3 (29):  WO-050 through WO-081
WAVE 4 (33):  WO-085 through WO-121

Full work orders to write (from TEMPLATE.md):
Priority order for writing WOs before Jules sessions start:
  1. WO-001 (identity-auth) — most depended-upon
  2. WO-005 (api-gateway routing)
  3. WO-010 (task-core) — already written ✅
  4. WO-025 (ai-infrastructure)
  5. WO-006 (websocket)
  ...then all Wave 2 WOs in parallel
```
