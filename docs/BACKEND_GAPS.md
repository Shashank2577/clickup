# Backend Gaps Analysis: ClickUp Features vs Our API

> Identifies features visible in ClickUp's UI that are NOT yet implemented in our backend.
> Generated 2026-04-26 by comparing live ClickUp crawl against our 19 microservices.

---

## Legend
- **MISSING** = Feature has no backend support at all
- **PARTIAL** = Some backend exists but key sub-features are missing
- **NEEDS SERVICE** = Requires an entirely new microservice

---

## 1. Core Task Management

### 1.1 PARTIAL: Task Types
**ClickUp has**: Task type selector dropdown on task detail (e.g., Task, Milestone, Bug).
**Our backend**: `task-service` has basic task CRUD but no task type system.
**Gap**: Need `task_types` table, type-specific fields, type icons/colors configuration per space.

### 1.2 PARTIAL: Task Relationships
**ClickUp has**: Relationships field on task detail - link tasks as blocking, waiting on, related to, etc.
**Our backend**: No relationship linking between tasks.
**Gap**: Need `task_relationships` table with relationship types (blocks, blocked_by, related_to, duplicate_of).

### 1.3 MISSING: Task Merging
**ClickUp has**: "Merge" option in task context menu - merge duplicate tasks.
**Our backend**: No merge capability.
**Gap**: Need merge endpoint that combines subtasks, comments, attachments, and activity from source into target task.

### 1.4 MISSING: Task Conversion
**ClickUp has**: "Convert to" submenu - convert task to different types or to subtask.
**Our backend**: No conversion logic.
**Gap**: Need conversion endpoints (task→subtask, subtask→task, task→milestone, etc.).

### 1.5 MISSING: Description History
**ClickUp has**: "Description history" - version history of task description changes.
**Our backend**: No description versioning.
**Gap**: Need `task_description_versions` table with diff tracking.

### 1.6 PARTIAL: Custom Fields
**ClickUp has**: Full custom field manager in Settings with field types (Effort, Project Phase, Update Summary, etc.).
**Our backend**: `task-service` has custom fields but may lack the full field type system.
**Gap**: Verify support for all field types: Text, Number, Dropdown, Checkbox, Date, Email, Phone, URL, Rating, Currency, Progress, Relationship, Formula, Rollup, Labels, Files, People, Auto-number, Location, Short text.

### 1.7 MISSING: Task Templates
**ClickUp has**: "Templates" submenu on task - save as template or apply template.
**Our backend**: No task template system.
**Gap**: Need `task_templates` table and apply/save template endpoints.

---

## 2. Views System

### 2.1 PARTIAL: View Engine
**ClickUp has**: 22+ view types with per-view configuration (filters, groups, sorts, columns).
**Our backend**: `views-service` supports List, Board, Gantt, Calendar view configs.
**Gap**: Missing view types:
- **Table view** (spreadsheet-like with inline editing)
- **Timeline view** (distinct from Gantt)
- **Workload/Capacity view** (team member hours/points)
- **Team view** (people-centric)
- **Map view** (geographic)
- **Mind Map view** (hierarchical visualization)
- **Activity Feed view** (chronological stream)
- **Embed views** (website, Google Sheets/Docs/Calendar/Maps, YouTube, Figma)

### 2.2 MISSING: View Sharing & Permissions
**ClickUp has**: Private view checkbox, Pin view, per-view sharing.
**Our backend**: No per-view permission model.
**Gap**: Need `view_permissions` with private/shared/pinned states per user.

### 2.3 MISSING: View Templates
**ClickUp has**: "Create with AI" view option - AI generates view configuration.
**Our backend**: No AI-powered view creation.
**Gap**: Need AI integration in views-service for natural-language view creation.

---

## 3. Workspace & Hierarchy

### 3.1 MISSING: Favorites System
**ClickUp has**: Star/favorite on tasks, spaces, docs, dashboards, views. Favorites section in sidebar.
**Our backend**: No favorites/bookmarks system.
**Gap**: Need `user_favorites` table with polymorphic entity reference (task, space, doc, dashboard, view).

### 3.2 MISSING: Sidebar Customization
**ClickUp has**: "Customize your sidebar" option - reorder, hide, pin items.
**Our backend**: No sidebar configuration storage.
**Gap**: Need `user_sidebar_config` for sidebar item ordering and visibility.

### 3.3 PARTIAL: Space Overview
**ClickUp has**: Space overview page with Recent, Docs, Bookmarks cards, Folders/Lists sections.
**Our backend**: `identity-service` has space/list CRUD but no overview aggregation.
**Gap**: Need overview aggregation endpoint combining recent items, docs, bookmarks per space.

---

## 4. Communication & Collaboration

### 4.1 MISSING: Channels (Chat)
**ClickUp has**: Full chat system with Channels (#general, #welcome, etc.), Direct Messages, threads, Add Channel.
**Our backend**: No chat/messaging service.
**Gap**: **NEEDS NEW SERVICE** - `chat-service` with channels, DMs, threads, reactions, @mentions, file sharing. WebSocket real-time delivery.

### 4.2 MISSING: SyncUps (Video/Audio)
**ClickUp has**: SyncUps feature in Clips hub - video/audio calls.
**Our backend**: No audio/video calling.
**Gap**: **NEEDS NEW SERVICE** or third-party integration (e.g., Daily.co, Twilio). Low priority for MVP.

### 4.3 MISSING: AI Notetaker
**ClickUp has**: AI Notetaker in Clips hub - automated meeting transcription and action items.
**Our backend**: No meeting transcription.
**Gap**: Requires AI service integration with audio processing. Low priority.

### 4.4 PARTIAL: Comments
**ClickUp has**: Rich comment editor with: text formatting, emoji, file attachments, audio, @mentions, reactions, embeds, links, video, code blocks, clipboard, task references, @Brain AI assistant.
**Our backend**: `comment-service` has threaded comments with mentions and reactions.
**Gap**: Missing: audio comments, embed support, @Brain AI integration, task reference linking, code block rendering metadata.

---

## 5. AI Features

### 5.1 PARTIAL: AI Integration
**ClickUp has**:
- "Ask AI" button on task detail and everywhere
- "Write with AI" for descriptions
- "Prioritize with AI" in priority dropdown
- "Ask Brain to write a description, create a summary or find similar tasks"
- "@Brain" in comment input
- "Create with AI" in view creation
- "Super Agent" in create menu
- AI Team Center dashboard
- AI Personal Center dashboard
- AI Usage tracking in settings

**Our backend**: `ai-service` has task breakdown, summarization, doc generation.
**Gap**: Missing:
- AI-powered prioritization
- Similar task finding
- AI view creation
- AI agent (Super Agent)
- AI usage tracking/metering
- Brain @-mention in comments integration
- AI dashboard widgets

---

## 6. Time & Scheduling

### 6.1 PARTIAL: Time Tracking
**ClickUp has**: Full timesheet with weekly grid, billable status, tag filtering, tracked time aggregation, approvals workflow.
**Our backend**: `task-service` has basic time tracking entries.
**Gap**: Missing:
- Billable/non-billable status per entry
- Timesheet approval workflow (submit → approve/reject)
- "All timesheets" aggregation across team
- Work Schedule configuration (from Settings)
- Time entry tags

### 6.2 MISSING: Calendar Integration
**ClickUp has**: Google Calendar + Microsoft Outlook integration, meeting sync, time blocking.
**Our backend**: No calendar integration.
**Gap**: **NEEDS SERVICE** - `calendar-integration` service for OAuth + sync with Google/Microsoft APIs.

### 6.3 MISSING: Reminders
**ClickUp has**: "Create Reminder" personal tool, "Remind me in Inbox" on tasks.
**Our backend**: No reminder system (notifications exist but not user-created reminders).
**Gap**: Need `reminders` table in notification-service with scheduled delivery.

---

## 7. Content & Documentation

### 7.1 PARTIAL: Docs/Wiki
**ClickUp has**: Full docs hub with templates (Project Overview, Meeting Notes, Wiki), import, sharing, tags, favorites, Popular Wikis.
**Our backend**: `docs-service` has real-time CRDT editing and snapshots.
**Gap**: Missing:
- Doc templates system
- Wiki mode (distinct from regular docs)
- Doc tags
- Doc import (from external sources)
- Popular Wikis aggregation

### 7.2 MISSING: Whiteboards
**ClickUp has**: Full whiteboard hub with templates (Org Chart, Action Plan, Customer Journey Map), collaborative canvas.
**Our backend**: No whiteboard service.
**Gap**: **NEEDS SERVICE** - `whiteboard-service` with real-time collaborative canvas (similar to CRDT approach in docs-service).

### 7.3 MISSING: Forms
**ClickUp has**: Forms hub with templates (Feedback, Project Intake, Order, Job Application, IT Requests), form builder, response collection.
**Our backend**: No form service.
**Gap**: **NEEDS SERVICE** - `form-service` with form builder, field types, conditional logic, response storage, task creation from submissions.

### 7.4 MISSING: Clips (Screen Recording)
**ClickUp has**: Video clips, voice clips, recording UI, sharing, clip library.
**Our backend**: No clip/recording service.
**Gap**: **NEEDS SERVICE** - `clips-service` for video/audio storage, transcoding, sharing. Uses `file-service` for blob storage. Lower priority.

---

## 8. Reporting & Analytics

### 8.1 PARTIAL: Dashboards
**ClickUp has**: Dashboard templates (Simple, AI Team Center, Time Tracking, Project Management, AI Personal Center), widget-based, drag-and-drop layout, schedule report, share, export.
**Our backend**: `dashboard-service` has dashboard widgets, metrics, burndown/velocity.
**Gap**: Missing:
- Dashboard templates system
- AI-powered dashboard widgets (AI Team Center, AI Personal Center)
- Scheduled report delivery (email/Slack)
- Dashboard export (PDF/image)
- Widget-level sharing

---

## 9. Integrations & Platform

### 9.1 MISSING: Universal Search Across Integrations
**ClickUp has**: Search across ClickUp + Confluence + GitHub + Gmail + Google Drive + Teams + SharePoint + Apps.
**Our backend**: `search-service` only indexes ClickUp data.
**Gap**: Need integration connectors for external search. Major effort. Could use third-party unified search API.

### 9.2 MISSING: App Center
**ClickUp has**: Full App Center in Settings for third-party integrations.
**Our backend**: `github-integration`, `gitlab-integration`, `slack-service` exist but no generic app center.
**Gap**: Need app marketplace framework - app registry, OAuth flows, webhook routing.

### 9.3 MISSING: Email Integration
**ClickUp has**: "Send email to task" feature, email integration settings.
**Our backend**: `notification-service` sends emails but doesn't receive them.
**Gap**: Need inbound email processing - email-to-task, email replies to comments.

### 9.4 MISSING: ClickUp API (Developer Platform)
**ClickUp has**: ClickUp API settings page for developer access.
**Our backend**: REST API exists but no developer portal, API key management, or rate limiting dashboard.
**Gap**: Need API key CRUD endpoints, usage tracking, developer docs generation.

### 9.5 MISSING: Imports/Exports
**ClickUp has**: Import from external tools, export data.
**Our backend**: No import/export system.
**Gap**: Need data import (CSV, JSON, from Jira/Trello/Asana) and export (CSV, JSON) endpoints.

---

## 10. User & Workspace Management

### 10.1 MISSING: Teams Management
**ClickUp has**: Teams hub with team creation, member management, team activity visualization.
**Our backend**: `identity-service` has workspace/member management but no team concept.
**Gap**: Need `teams` table, team membership, team-level views and dashboards.

### 10.2 MISSING: Audit Logs
**ClickUp has**: Audit Logs in admin settings.
**Our backend**: Logging exists (Pino) but no structured audit trail.
**Gap**: Need `audit_logs` table capturing all user actions with timestamps, actor, action, target entity.

### 10.3 MISSING: Trash/Recovery
**ClickUp has**: Trash page with recoverable deleted items.
**Our backend**: Hard delete in most services.
**Gap**: Need soft-delete pattern across all services with recovery endpoints. Add `deleted_at` columns.

### 10.4 PARTIAL: User Preferences
**ClickUp has**: Theme color (10 options), Appearance (Light/Dark/Auto), Contrast, notification preferences, work schedule.
**Our backend**: `preference.schema.ts` exists in contracts.
**Gap**: Verify support for theme color, appearance mode, contrast, keyboard shortcut customization.

### 10.5 MISSING: Workspace Theming
**ClickUp has**: 10 theme accent colors, Light/Dark/Auto mode, High Contrast.
**Our backend**: No theme management.
**Gap**: Need user-level theme preferences stored and served via API.

---

## 11. Automations

### 11.1 PARTIAL: Automations
**ClickUp has**: "Automate" button on every space/list, Automations Manager in settings.
**Our backend**: `automations-service` has event-driven automation engine.
**Gap**: Verify coverage of all trigger types and action types available in ClickUp UI. Specifically:
- Agents (new ClickUp feature)
- AI-powered automation suggestions
- Automation templates

---

## 12. Real-time & Notifications

### 12.1 PARTIAL: Real-time Updates
**ClickUp has**: Live updates across all views, presence indicators (green dots), typing indicators.
**Our backend**: WebSocket support via `api-gateway` + NATS, CRDT for docs.
**Gap**: Missing:
- User presence tracking (online/offline/away)
- Typing indicators in comments/chat
- Live cursor positions in docs (may exist in Yjs)

### 12.2 PARTIAL: Notifications
**ClickUp has**: Browser notification permission, mute notifications, notification center in inbox with Primary/Other/Later/Cleared categories.
**Our backend**: `notification-service` handles push, email, in-app.
**Gap**: Missing:
- Notification categorization (Primary/Other)
- "Later" snooze functionality
- "Cleared" history
- Browser push notification registration
- Per-channel mute controls

---

## Summary: Priority Matrix

### Must Have (P0) - Critical for MVP
| Gap | Effort | Service |
|-----|--------|---------|
| Chat/Channels (DMs, threads) | High | NEW: chat-service |
| Favorites system | Low | identity-service |
| View types (Table, Timeline, Workload) | Medium | views-service |
| Task relationships | Low | task-service |
| Task templates | Low | task-service |
| Soft delete / Trash | Medium | All services |
| Notification categories | Low | notification-service |
| Teams management | Medium | identity-service |
| User presence | Low | api-gateway |

### Should Have (P1) - Important for parity
| Gap | Effort | Service |
|-----|--------|---------|
| Forms builder + responses | High | NEW: form-service |
| Whiteboards | High | NEW: whiteboard-service |
| Calendar integration | Medium | NEW: calendar-integration |
| Dashboard templates + export | Medium | dashboard-service |
| AI view creation | Low | ai-service + views-service |
| Reminders | Low | notification-service |
| Import/Export | Medium | NEW: import-export-service |
| Description history | Low | task-service |
| Audit logs | Medium | NEW: audit-service |
| Sidebar customization | Low | identity-service |

### Nice to Have (P2) - Enhancement
| Gap | Effort | Service |
|-----|--------|---------|
| Clips (screen recording) | High | NEW: clips-service |
| SyncUps (video calls) | Very High | Third-party integration |
| AI Notetaker | High | ai-service |
| Universal search (cross-app) | Very High | search-service + integrations |
| App Center marketplace | High | NEW: integration-platform |
| Super Agent | High | ai-service |
| Email-to-task | Medium | notification-service |
| Workspace theming | Low | identity-service |
| Task merging | Low | task-service |
| Task conversion | Low | task-service |

---

## New Services Needed

| Service | Priority | Purpose |
|---------|----------|---------|
| `chat-service` | P0 | Channels, DMs, threads, real-time messaging |
| `form-service` | P1 | Form builder, field types, response collection |
| `whiteboard-service` | P1 | Collaborative canvas with real-time editing |
| `calendar-integration` | P1 | Google/Microsoft calendar sync |
| `import-export-service` | P1 | Data import from competitors, CSV/JSON export |
| `audit-service` | P1 | Structured audit trail for compliance |
| `clips-service` | P2 | Screen recording storage and sharing |
| `integration-platform` | P2 | Generic app marketplace and OAuth routing |
