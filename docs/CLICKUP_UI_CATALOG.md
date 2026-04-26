# ClickUp UI Feature Catalog

> Comprehensive catalog of every ClickUp screen, feature, interaction, and component.
> Crawled from live ClickUp app on 2026-04-26.

---

## Table of Contents

1. [Global Layout & Navigation](#1-global-layout--navigation)
2. [Home & My Tasks](#2-home--my-tasks)
3. [Inbox](#3-inbox)
4. [Planner](#4-planner)
5. [AI Hub](#5-ai-hub)
6. [Teams Hub](#6-teams-hub)
7. [Docs Hub](#7-docs-hub)
8. [Dashboards Hub](#8-dashboards-hub)
9. [Whiteboards Hub](#9-whiteboards-hub)
10. [Forms Hub](#10-forms-hub)
11. [Clips Hub](#11-clips-hub)
12. [Goals](#12-goals)
13. [Timesheets](#13-timesheets)
14. [Space & Hierarchy](#14-space--hierarchy)
15. [Task Views](#15-task-views)
16. [Task Detail](#16-task-detail)
17. [Search & Command Palette](#17-search--command-palette)
18. [Create Menu](#18-create-menu)
19. [Settings](#19-settings)
20. [User Profile Menu](#20-user-profile-menu)
21. [Interaction Patterns](#21-interaction-patterns)
22. [Design System Observations](#22-design-system-observations)

---

## 1. Global Layout & Navigation

### 1.1 Layout Structure
- **3-column layout**: Icon Rail (48px) | Secondary Sidebar (240px, collapsible) | Main Content (fluid)
- **Top Bar**: Workspace name + dropdown | Quick actions | Search (⌘K) | Utility icons | User avatar
- **Notification Banner**: Dismissible top banner (e.g., permission requests) with Enable/Remind me/X actions

### 1.2 Icon Rail (Left Edge - Primary Nav)
Fixed vertical icon rail with labeled icons:

| Position | Icon | Label | Route |
|----------|------|-------|-------|
| 1 | Home | Home | `/inbox` or `/my-work` |
| 2 | Calendar | Planner | `/calendar` |
| 3 | Sparkle | AI | `/ai` |
| 4 | People | Teams | `/teams-pulse` |
| 5 | Document | Docs | `/docs` |
| 6 | Chart | Dashboard | `/hubs/dashboards` |
| 7 | Canvas | Whiteboards | `/hubs/whiteboards` |
| 8 | Checkbox | Forms | `/forms` |
| 9 | Screen | Clips | `/hubs/clips` |
| 10 | Target | Goals | `/goals` |
| 11 | Clock | Timesheets | `/time` |
| 12 | Grid dots | More | Expandable menu |
| Bottom | Person+ | Invite | Invite modal |
| Bottom | Gem | Upgrade | Pricing page |

**Behavior**: Active item gets highlighted background + colored icon. Hover shows tooltip. Clicking expands/collapses secondary sidebar for some items.

### 1.3 Secondary Sidebar (Contextual Panel)
Appears when Home is active. Contains:
- **Home section**: Inbox, Replies, Assigned Comments, My Tasks, ... More
- **Favorites**: Collapsible, "Add to your sidebar" prompt
- **Channels**: Channel list with # icons, + Add Channel
- **Direct Messages**: User list, + New message
- **Spaces**: Hierarchical tree
  - All Tasks (workspace-level)
  - Space entries (with color dot, ..., + icons on hover)
    - Folder entries (with task count badge)
    - List entries
  - + New Space

### 1.4 Top Bar Components
- **Left**: Workspace name with dropdown chevron | Duplicate window icon | Search/filter icon | Collapse sidebar (« icon)
- **Center**: Search bar with magnifying glass icon + "Search ⌘K" placeholder + AI sparkle
- **Right**: Quick action icons (left to right):
  - Quick create (pencil+)
  - Automations/recurring (circular arrow)
  - Clips/video (camera)
  - Notepad (document)
  - Reminders (bell)
  - Reports (chart)
  - User avatar "SS" with green online dot + dropdown chevron

---

## 2. Home & My Tasks

### 2.1 My Tasks Page (`/my-work`)
**Header**: "My Tasks" with "Manage cards" button and gear icon

**Greeting**: "Good evening, [Name]" - time-aware greeting

**Left Sidebar Sub-items**:
- Assigned to me
- Today & Overdue (with count badge)
- Personal List

**Main Content Cards**:
- **Recents** card: Shows recently accessed items as skeleton/blur rows
- **Agenda** card (right column):
  - Calendar integration prompt
  - Google Calendar "Connect" button
  - Microsoft Outlook "Connect" button
- **My Work** section:
  - **Tabs**: To Do | Done | Delegated
  - **Groups** (collapsible):
    - Today (count)
    - Overdue (count)
    - Next (count)
    - Unscheduled (count)
  - **Task rows**: Emoji icon | Task name | Space · List breadcrumb | Date | Priority flag
- **Assigned to me** card (right column)

---

## 3. Inbox

### 3.1 Inbox Page (`/inbox`)
**Tabs**: Primary | Other | Later | Cleared
- Each tab shows filtered notifications
- **Toolbar**: Filter button | Settings gear | Clear all

**Empty State**: "Looking to collaborate?" with "Invite people" CTA

**Notification Types** (inferred from tabs):
- Task assignments
- Comments and mentions
- Status changes
- Due date reminders

---

## 4. Planner

### 4.1 Calendar/Planner Page (`/calendar`)
**Onboarding state** (no calendar connected):
- Hero: "You, but better organized"
- Description about calendar management, time blocking, meeting notes
- **Connect buttons**: Google Calendar | Microsoft Outlook
- **Feature cards** (carousel with arrows):
  - Join your next meeting
  - Automate your meeting notes (AI Notetaker)
  - Block time for your tasks (drag tasks to calendar)

---

## 5. AI Hub

### 5.1 AI Page (`/ai`)
- Appears as blank/loading for non-premium users
- Expected features: AI chat, task suggestions, writing assistance, summarization

---

## 6. Teams Hub

### 6.1 Teams Page (`/teams-pulse`)
**Onboarding state**:
- Hero: "Align teams and visualize their work!"
- CTAs: "Create Team" | "Browse People"
- **Feature cards**:
  - Teams Hub - central overview of all activity
  - Member & team management - browse, find, manage members
  - Stay focused with... - agenda view per member

---

## 7. Docs Hub

### 7.1 Docs Home (`/docs`)
**Left Sidebar**:
- All Docs
- My Docs (count badge)
- Shared with me
- Private
- Meeting Notes
- Archived
- **Favorites**: Star placeholder
- **Popular Wikis**: Skeleton loading

**Main Content**:
- Header: "All Docs" with **Import** and **New Doc** buttons (dropdown)
- **Templates row**: Project Overview | Meeting Notes | Wiki (each with icon + description)
- **Toolbar**: Filters | Sort | Tags | View all | Search
- **Table columns**: Name | Location | Tags | Date updated | Date viewed ↓ | Sharing | ... (actions)
- **Row items**: Doc name (with icon) | Space/List location | Dates | Share icon | More menu

---

## 8. Dashboards Hub

### 8.1 Dashboards Home (`/hubs/dashboards`)
**Left Sidebar**:
- All Dashboards
- My Dashboards
- Shared with me
- Private
- **Favorites**: Star placeholder

**Main Content** - Template Picker:
- "Choose a Dashboard template"
- **Templates** (2x3 grid):
  - Simple Dashboard - "Manage and prioritize tasks"
  - AI Team Center - "View team activity with AI"
  - Time Tracking (Business badge) - "View and report on time tracking metrics"
  - Project Management (Business badge) - "Analyze project progress and metrics"
  - AI Personal Center - "Improve your performance with AI cards"
  - + Start from scratch

---

## 9. Whiteboards Hub

### 9.1 Whiteboards Home (`/hubs/whiteboards`)
**Left Sidebar**:
- All Whiteboards
- My Whiteboards
- **Favorites**: Star placeholder

**Main Content**:
- Header: "All Whiteboards" with **New Whiteboard** button (dropdown)
- **Templates row**: Organizational Chart | Action Plan | Customer Journey Map
- **Toolbar**: Sort | Search | List/Grid toggle
- **Grid view**: Whiteboard thumbnail cards in responsive grid (5 columns)

---

## 10. Forms Hub

### 10.1 Forms Home (`/forms`)
**Left Sidebar**:
- All Forms
- My Forms
- **Favorites**: Star placeholder

**Main Content** - Template Picker:
- "Choose a Form template"
- **Templates** (2x3 grid):
  - Feedback Form - "Survey and collect feedback"
  - Project Intake - "Streamline new project requests"
  - Order Form - "Capture and process client orders"
  - Job Application - "Accept and review applications"
  - IT Requests - "Triage and prioritize IT service requests"
  - + Start from scratch

---

## 11. Clips Hub

### 11.1 Clips Home (`/hubs/clips`)
**Left Sidebar**:
- All Clips
- Video Clips
- Voice Clips
- SyncUps
- AI Notetaker

**Main Content**:
- "Welcome to Clips"
- **Feature cards (3 columns)**:
  - Record in a snap - screen capture UI preview
  - Unlock async productivity - clips gallery preview
  - Watch, share, collaborate - sharing UI preview
- **Recording UI preview**: New tab icons | Record Clip dialog showing microphone + screen selection + "Start recording ⌘⌥S"
- **Empty state CTA**: "Create your first Clip!" with "Create Clip" button

---

## 12. Goals

### 12.1 Goals Page (`/goals`)
**Empty State**:
- "Make your goals a reality."
- Description about measurable targets and real-time tracking
- Illustration showing goal UI with progress indicators
- **CTA**: "Set a Goal" button | "Learn more" link

---

## 13. Timesheets

### 13.1 Timesheets Page (`/time`)
**Top Tabs**: Timesheets | **My timesheet** (active) | All timesheets | Approvals

**Controls**:
- Week navigator: "< > Apr 26 - May 2 v" (prev/next arrows + dropdown)
- **Filter pills**: $ Billable status | Tag | Tracked time
- **View toggle**: Timesheet view | Time entries view
- **Configure** button (right)

**Grid Layout**:
- **Columns**: Task / Location | Sun Apr 26 (0h) | Mon Apr 27 (0h) | ... | Sat May 2 (0h) | Total (0h)
- Blue highlight bar on current day
- **Empty state**: "No time entries for this week" + stopwatch icon + "Track time" button
- **Footer**: "+ Add task" button

---

## 14. Space & Hierarchy

### 14.1 Information Architecture
```
Workspace
├── Space (color-coded, icon)
│   ├── Folder (optional grouping)
│   │   └── List
│   │       └── Tasks
│   └── List (directly in Space)
│       └── Tasks
└── Space 2
    └── ...
```

### 14.2 Space Overview (`/v/o/s/:id`)
**Header**: Space name with star toggle + dropdown
**View Tabs**: Add Channel | Overview | List | + View
**Right Toolbar**: Agents | Automate | Ask AI | Share

**Overview Content**:
- Toolbar: Filters | Refreshed: just now | Auto refresh: On | Customize | Add card
- **Cards**: Recent | Docs | Bookmarks (3-column layout)
- **Folders** section
- **Lists** section

### 14.3 Sidebar Space Tree
- **All Tasks** - workspace-level task aggregation
- **Space entries** with:
  - Color dot icon
  - Space name
  - Hover actions: ... (menu) | + (create)
  - Expandable children: Folders and Lists
  - Task count badges on Lists
- **+ New Space** at bottom

---

## 15. Task Views

### 15.1 Available View Types (Complete)

**Core Views**:
| View | Icon | Description |
|------|------|-------------|
| List | Horizontal lines | Flat/grouped task table with sortable columns |
| Board (Kanban) | Columns | Drag-and-drop cards grouped by status/field |
| Calendar | Calendar | Tasks on calendar grid by date |
| Gantt Chart | Timeline bars | Timeline with dependencies and date ranges |
| Table | Grid | Spreadsheet-like editable grid |
| Timeline | Horizontal lines | Simplified timeline view |
| Workload (Capacity) | Stacked bars | Team member capacity planning |
| Team | People | Team-centric task distribution |
| Map | Pin | Geographic visualization of tasks |
| Mind Map | Branches | Hierarchical mind map visualization |
| Activity Feed | Stream | Chronological activity stream |

**Content Views**:
| View | Icon | Description |
|------|------|-------------|
| Doc Wiki | Document | Embedded document/wiki |
| Form Survey | Checkbox | Form builder for task intake |
| Dashboard Report | Chart | Embedded dashboard widgets |
| Whiteboard | Canvas | Embedded whiteboard |

**Embed Views**:
| View | Icon | Description |
|------|------|-------------|
| Any website | Globe | Embed any URL |
| Google Sheets | Green grid | Embed Google Sheets |
| Google Docs | Blue doc | Embed Google Docs |
| Google Calendar | Calendar | Embed Google Calendar |
| Google Maps | Pin | Embed Google Maps |
| YouTube | Play | Embed YouTube videos |
| Figma | Purple F | Embed Figma designs |

**AI View**:
- Create with AI - AI-assisted view creation

**View Options**: Private view checkbox | Pin view checkbox

### 15.2 List View Detail
**Toolbar**:
- Group by: [field] (e.g., Project Phase)
- Expanded/Collapsed toggle
- Columns picker
- Filter | Closed toggle | Assignee filter | Search | Customize | Add Task (button with dropdown)

**Table Structure**:
- **Group headers**: Collapsible groups with count + ... menu + add button
- **Column headers** (sortable): Name | Due date ↑ | Priority | Effort | Status | Assignee | Settings gear
- **Task rows**:
  - Expand/collapse arrow (for subtasks)
  - Status circle icon (color-coded)
  - Task name
  - Subtask count indicator (branch icon + count)
  - Inline column values
- **Subtask rows**: Indented under parent, same column structure
- **Footer**: "+ Add Task" per group

### 15.3 Board (Kanban) View Detail
**Toolbar**: Group: Status | Expanded | Priority (sort) | Filter | Closed | Assignee | Search | Customize | Add Task

**Columns**:
- One column per status: TO DO | IN PROGRESS | IN REVIEW | DONE | COMPLETED
- Column header: Status badge (colored) + count
- "+ Add group" button after last column

**Cards**:
- Parent breadcrumb label (small, gray)
- **Task title** (bold)
- Inline icons: Status dot | Priority flag | Date icon
- Date range text
- Custom field rows
- Subtask count with collapse toggle
- Drag handle (implicit)

**Footer per column**: "+ Add Task"

### 15.4 Gantt/Timeline View Detail
**Toolbar**: Today | Month (dropdown) | Auto fit | Export | Save view | Sort | Filter | Closed | Assignee | Search | Customize | Add Task

**Split Layout**:
- **Left panel**: Task tree (name column, collapsible hierarchy)
- **Right panel**: Horizontal timeline
  - Month headers with day numbers
  - Task bars (color-coded by status)
  - Today marker (red vertical line)
  - Zoom controls (+/-)
  - Dependency arrows (when set)

---

## 16. Task Detail

### 16.1 Task Detail Page (Full-page view, `/t/:taskId`)
**Top Bar**:
- Navigation: ◀ ▶ (back/forward) | Breadcrumb: "Space / List" + add button
- Right: "Created [date]" | Ask AI | Share | ... menu | Star | Pin | Close (X)

### 16.2 Task Header
- **Type selector**: "Task v" dropdown (can change task type)
- **Task ID**: Alphanumeric (e.g., 86d2rr889)
- **Ask AI** button
- **Title**: Large, inline-editable text
- **AI prompt**: "Ask Brain to write a description, create a summary or find similar tasks"

### 16.3 Properties (2-column grid)
| Property | Type | Details |
|----------|------|---------|
| Status | Dropdown | Grouped: Not started (TO DO), Active (IN PROGRESS, IN REVIEW), Done (DONE), Closed (COMPLETED). Searchable, color-coded with icons |
| Assignees | Multi-select | User avatars, searchable |
| Dates | Date range | Start date → Due date with calendar pickers |
| Priority | Dropdown | Urgent (red), High (orange), Normal (blue), Low (gray), Clear. "Prioritize with AI" option |
| Track Time | Timer | "Add time" button, timer controls |
| Tags | Multi-select | Searchable tag picker |
| Relationships | Link picker | Link to other tasks/docs |
| Hide empty properties | Toggle | Collapses empty fields |

### 16.4 Description
- Rich text editor placeholder: "Add description"
- "Write with AI" button (sparkle icon)

### 16.5 Custom Fields Section
- **Header**: "Fields"
- Each field shows: Icon | Field name | Value (or dash)
- Example fields: Effort, Project Phase, Update Summary

### 16.6 Subtasks Section
- **Header**: "Subtasks" with progress bar (e.g., 1/3 = 33%)
- **Table**: Name | Assignee | Priority | Due date | Timer icon | ... menu
- Each subtask shows status icon (green check/dot)
- **Footer**: "+ Add Task"

### 16.7 Checklists Section
- **Header**: "Checklists"
- CTA: "+ Create checklist"

### 16.8 Attachments Section
- **Header**: "Attachments"
- Drag-and-drop zone: "Drop your files here to upload"

### 16.9 Activity Panel (Right Side)
- **Header**: "Activity" with Search icon | Comment count | Filter | Settings
- **Activity Feed**: Chronological entries with timestamps
  - "You created this task - [date]"
  - "You created subtask: [name] - [date]"
  - "Show more" expandable
- **Comment Input** (bottom):
  - "Mention @Brain to create, find, ask anything"
  - **Rich text toolbar**: + | AI sparkle | emoji | attachment | audio | @mention | reactions | embed | link | video | code | clipboard | task reference | Send button with dropdown

### 16.10 Task Context Menu (... button)
**Actions (organized)**:
- **Quick actions row**: Copy link | Copy ID | New tab
- **Organization**: Favorite | Unfollow task | Remind me in Inbox
- **Move/Copy**: Move to | Add to | Merge | Duplicate
- **Configuration**: Convert to | Custom Fields | Templates
- **Metadata**: Relationships | Description history | Task Type
- **Export**: Print | Send email to task
- **Display**: Section Tabs (toggle)
- **Danger**: Archive | Delete
- **Permissions**: "Sharing & Permissions" button (full-width)

---

## 17. Search & Command Palette

### 17.1 Universal Search (`⌘K`)
**Input**: "Search, run a command, or ask a question..." + Ask AI button

**Source Tabs**: All | ClickUp | Confluence | GitHub | Gmail | Google Drive | Teams | SharePoint | Apps

**Content Type Filters**: Tasks | Docs | # Channels | Messages | Agents | ... | Filter | Sort

**Results**:
- Each result shows: Status icon | Name | "in [Location]" | Time ago
- Hover actions: Ask AI | Link | Open | More (...)
- Results include tasks, lists, docs, channels

**Bottom Bar**: Navigation arrows | "Type / to view available commands, hit tab on a selected item to see additional actions" | Settings

---

## 18. Create Menu

### 18.1 + Create Button Menu
**Search**: "Describe anything to create"

**Create Items**:
| Item | Shortcut | Description |
|------|----------|-------------|
| Task | ⌘T | Create a new task |
| Message | ⌘G | Send a message |
| List | - | Track tasks, projects, people & more |
| Channel | - | Conversations on specific topics |
| Space | - | Organize work by team or department |
| Create with AI | - | AI-assisted creation |
| Super Agent | - | (Hot badge) AI agent |
| Doc | - | Create document |
| Form | - | Create form |
| Dashboard | - | Create dashboard |
| Whiteboard | - | Create whiteboard |

**Bottom**: Customize your sidebar | Import | Templates

---

## 19. Settings

### 19.1 Settings Page (`/settings/profile`)
**Left Sidebar Categories**:

**Admin**:
- General (workspace settings)
- People (member management)
- Teams
- Upgrade (plan management)
- AI Usage
- Security & Permissions
- Audit Logs
- Trash

**Features**:
- Custom Field Manager
- Template Center
- Automations Manager
- AI Notetaker
- Spaces
- Task Types
- Work Schedule

**Integrations & ClickApps**:
- App Center
- Imports / Exports
- ClickUp API
- Email Integration

**My Settings**:
- Preferences (profile, theme, appearance)
- Notifications
- Workspaces
- Chat
- Referrals
- Log out

### 19.2 Profile/Preferences Content
- **Profile**: Avatar, Full Name, Email, Password
- **2FA**: Text Message (SMS) | Authenticator App (TOTP)
- **Theme color**: 10 color swatches (dark, teal, blue, pink, purple, light blue, orange, cyan, tan, green)
- **Appearance**: Light | Dark | Auto (3 preview cards)
- **Contrast**: High Contrast toggle
- "Save changes" button

---

## 20. User Profile Menu

### 20.1 Avatar Dropdown
- **User info**: Name + "Online" status
- Set status
- Mute notifications (submenu)
- ---
- Settings | Themes | Keyboard shortcuts
- Download ClickUp | Help
- **Personal Tools**: Create task, My Work, Track Time, Notepad, Record a Clip, Create Reminder, Create Doc, Create Whiteboard, View People, Create Dashboard, AI Notetaker
- Trash | Log out

---

## 21. Interaction Patterns

### 21.1 Dropdowns & Selectors
- **Status dropdown**: Grouped categories with search, color-coded icons, checkmarks for current
- **Priority dropdown**: Flag icons with colors (Urgent=red, High=orange, Normal=blue, Low=gray), Clear option, "Prioritize with AI"
- **Date picker**: Calendar grid with range selection (start → due date)
- **Assignee picker**: User search with avatar display, multi-select
- **Tag picker**: Searchable, multi-select, color-coded

### 21.2 Drag & Drop
- Board view: Drag cards between status columns
- List view: Reorder tasks (inferred)
- Gantt view: Resize/move task bars
- Dashboard: Rearrange widgets
- Sidebar: Reorder spaces/folders/lists

### 21.3 Inline Editing
- Task titles: Click to edit
- Column values: Click to open picker/editor
- Dates: Click to open calendar
- Description: Click to activate rich text editor

### 21.4 Keyboard Shortcuts
- ⌘K: Search/Command palette
- ⌘T: Create task
- ⌘G: Create message
- ⌘⌥S: Record clip
- /, Tab: Command mode in search

### 21.5 Collapsible/Expandable
- Sidebar sections (Favorites, Channels, DMs, Spaces)
- Task groups in List view
- Subtask hierarchy
- Space/Folder tree in sidebar

### 21.6 Context Menus
- Right-click / ... button on tasks: Full action menu
- ... button on spaces/folders/lists: Management menu
- Hover actions on search results

### 21.7 Modals & Overlays
- Task detail: Full-page with close button
- Settings: Full-page navigation
- Create dialogs: Dropdown menus
- Search: Overlay modal

---

## 22. Design System Observations

### 22.1 Color Palette
- **Primary accent**: Purple/violet (#7B68EE range)
- **Status colors**:
  - TO DO: Gray (#808080)
  - IN PROGRESS: Green (#22C55E)
  - IN REVIEW: Orange (#F59E0B)
  - DONE: Green (#22C55E with check)
  - COMPLETED: Green (#22C55E with circle check)
- **Priority colors**:
  - Urgent: Red (#EF4444)
  - High: Orange (#F59E0B)
  - Normal: Blue (#3B82F6)
  - Low: Gray (#9CA3AF)
- **Theme colors**: 10 accent options available
- **Backgrounds**: White (light mode), supports Dark + Auto modes
- **Surfaces**: White cards on light gray (#F8F9FA) backgrounds

### 22.2 Typography
- **Headings**: Bold, variable sizes (task titles ~20px, section headers ~16px)
- **Body**: 14px, medium weight
- **Labels**: 12px, gray color
- **Monospace**: Task IDs

### 22.3 Spacing
- **Sidebar width**: ~240px (collapsible)
- **Icon rail**: ~48px
- **Content padding**: ~24px
- **Card padding**: ~16px
- **Row height**: ~36px (list view)
- **Card gap**: ~12px (board view)

### 22.4 Components
- **Buttons**: Solid (primary purple), outlined, ghost, icon-only
- **Badges**: Colored pills for status (DONE, IN PROGRESS, TO DO)
- **Avatars**: Circular, 24-32px, with online dot
- **Icons**: Consistent icon set (likely custom or Phosphor/Lucide-based)
- **Tooltips**: On hover for icon buttons
- **Dropdowns**: Searchable with grouped sections
- **Tables**: Sortable columns with resize handles
- **Cards**: White with subtle border/shadow, hover states
- **Trees**: Collapsible with indent levels, expand/collapse arrows
- **Tabs**: Underlined active state, even spacing
- **Toggles**: Standard on/off switches
- **Progress bars**: Thin colored bars (subtask progress)
- **Empty states**: Illustration + description + CTA button

### 22.5 Animation/Transition Observations
- Sidebar collapse/expand: Smooth width transition
- Dropdown menus: Fade-in with slight scale
- Tab switching: Underline slides
- Card hover: Subtle elevation change
- Status/priority badges: Instant color change
- Page transitions: Content fade/load
- Notification banner: Slide-down
