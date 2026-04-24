# Task Service

The core engine for task management, subtasks, and complex workflows.

## 🚀 Key Features

- **Advanced Task CRUD**: Full lifecycle management for tasks and subtasks.
- **Materialized Paths**: High-performance recursive queries for task hierarchies.
- **Custom Fields**: Flexible metadata system supporting 14+ field types.
- **Sequencing**: Support for custom task ordering (lexicographical sorting).
- **Collaboration Tools**: Checklists, watchers, and task relations.
- **Time Tracking**: Native support for manual and automatic time entries.
- **Templates & Forms**: Reusable task structures and public intake forms.

## 🏗️ Technical Highlights

### Hierarchy
Tasks are organized using a materialized path pattern (`/list_id/task_id/subtask_id/`). This allows for sub-second retrieval of entire trees regardless of depth.

### Task Ordering
We use a fractional indexing approach for task reordering, allowing items to be inserted between any two existing tasks without re-balancing the entire list.

### Extensibility
The `custom_fields` system uses a workspace-level definition schema, ensuring consistency across lists while allowing individual tasks to store unique values.

## 🔌 Core APIs

- `GET /tasks/:id`: Retrieve task with subtasks and checklists.
- `POST /tasks/bulk-update`: Perform operations on thousands of tasks at once.
- `PATCH /tasks/lists/:listId/tasks/reorder`: Handle drag-and-drop sequencing.
- `POST /forms/submit/:slug`: Handle public task creation.

## 🛠️ Tech Stack

- **Node.js / Express**
- **PostgreSQL**: Optimized with GiST/GIN indexes for path and JSONB searching.
- **NATS JetStream**: Emits events for real-time updates and search indexing.
