# ClickUp OSS — QA Robot Folder

Automated full-stack test results, gap analysis, and living documentation.
Updated every test run. Screenshots stored in `screenshots/`.

## Documents

| File | Purpose |
|------|---------|
| `working.md` | Features confirmed working end-to-end |
| `not-working.md` | Features broken or erroring |
| `gaps.md` | Features missing vs real ClickUp |
| `ux-analysis.md` | UI/UX observations vs real ClickUp |
| `integrations.md` | External integration status vs real ClickUp |
| `test-suite.md` | Reusable manual + automated test cases |

## How to Run

```bash
# Start the stack
docker compose up -d

# Verify health
curl http://localhost:3333/api/health

# Open browser and navigate to http://localhost:3333
# Follow test-suite.md checklist
```

## Test Coverage by Feature Area

- Auth (Clerk sign-in/sign-up/org)
- Workspace / Space / Folder / List hierarchy
- Task CRUD + all fields
- Comments
- Docs
- Goals
- Dashboards
- Views (List, Board, Calendar, Gantt, Table)
- Notifications
- Search
- Members
- Automations
- Forms
- Sprints
- Chat
- AI Assistant
- File uploads
- Slack / GitHub / GitLab integrations
- Webhooks
- Audit logs
- Settings
