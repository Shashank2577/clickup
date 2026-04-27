import { create } from 'zustand'
import { api } from '@/lib/api-client'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  listId: string
  parentId?: string
  assignees: string[]
  tags: string[]
  startDate?: string
  dueDate?: string
  effort?: string
  subtaskCount: number
  subtasks?: Task[]
  customFields: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface TaskDetail extends Task {
  checklists: Checklist[]
  attachments: Attachment[]
  relations: Relation[]
  timeEntries: TimeEntry[]
  comments: Comment[]
}

interface Checklist { id: string; title: string; items: ChecklistItem[] }
interface ChecklistItem { id: string; text: string; completed: boolean; assigneeId?: string }
interface Attachment { id: string; name: string; url: string; size: number; type: string }
interface Relation { id: string; taskId: string; relatedTaskId: string; type: string; relatedTask?: { id: string; title: string; status: TaskStatus } }
interface TimeEntry { id: string; duration: number; startedAt: string; endedAt?: string; billable: boolean }
interface Comment { id: string; content: string; authorId: string; authorName: string; createdAt: string; reactions: { emoji: string; userIds: string[] }[] }

interface TaskState {
  tasks: Task[]
  taskDetail: TaskDetail | null
  isLoading: boolean
  isDetailLoading: boolean

  loadTasks: (listId: string, groupBy?: string) => Promise<void>
  loadMyTasks: (groupBy?: string) => Promise<void>
  loadTaskDetail: (taskId: string) => Promise<void>
  createTask: (data: { title: string; listId: string; parentId?: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<Task>
  updateTask: (taskId: string, data: Partial<Pick<Task, 'title' | 'status' | 'priority' | 'description' | 'assignees' | 'tags' | 'startDate' | 'dueDate'>>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  addComment: (taskId: string, content: string) => Promise<Comment>
  addAttachment: (taskId: string, file: File) => Promise<Attachment>
  addTimeEntry: (taskId: string, duration: number) => Promise<TimeEntry>
  addRelation: (taskId: string, relatedTaskId: string, type: string) => Promise<void>
  createChecklist: (taskId: string, title: string) => Promise<void>
  clearDetail: () => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  taskDetail: null,
  isLoading: false,
  isDetailLoading: false,

  loadTasks: async (listId, groupBy) => {
    set({ isLoading: true })
    const tasks = await api.get<Task[]>(`/tasks/list/${listId}`, { params: { groupBy } })
    set({ tasks, isLoading: false })
  },

  loadMyTasks: async (groupBy = 'dueDate') => {
    set({ isLoading: true })
    const tasks = await api.get<Task[]>('/tasks', { params: { assigneeId: 'me', groupBy } })
    set({ tasks, isLoading: false })
  },

  loadTaskDetail: async (taskId) => {
    set({ isDetailLoading: true })
    const [task, comments] = await Promise.all([
      api.get<TaskDetail>(`/tasks/${taskId}`),
      api.get<Comment[]>('/comments', { params: { taskId } }),
    ])
    set({ taskDetail: { ...task, comments }, isDetailLoading: false })
  },

  createTask: async (data) => {
    const task = await api.post<Task>('/tasks', { body: data })
    set({ tasks: [...get().tasks, task] })
    return task
  },

  updateTask: async (taskId, data) => {
    const updated = await api.patch<Task>(`/tasks/${taskId}`, { body: data })
    set({
      tasks: get().tasks.map(t => t.id === taskId ? { ...t, ...updated } : t),
      taskDetail: get().taskDetail?.id === taskId ? { ...get().taskDetail!, ...updated } : get().taskDetail,
    })
  },

  deleteTask: async (taskId) => {
    await api.delete(`/tasks/${taskId}`)
    set({ tasks: get().tasks.filter(t => t.id !== taskId) })
  },

  addComment: async (taskId, content) => {
    const comment = await api.post<Comment>('/comments', { body: { taskId, content } })
    if (get().taskDetail?.id === taskId) {
      set({ taskDetail: { ...get().taskDetail!, comments: [...get().taskDetail!.comments, comment] } })
    }
    return comment
  },

  addAttachment: async (taskId, file) => {
    const attachment = await api.upload<Attachment>(`/tasks/${taskId}/attachments`, file)
    if (get().taskDetail?.id === taskId) {
      set({ taskDetail: { ...get().taskDetail!, attachments: [...get().taskDetail!.attachments, attachment] } })
    }
    return attachment
  },

  addTimeEntry: async (taskId, duration) => {
    const entry = await api.post<TimeEntry>(`/tasks/${taskId}/time-entries`, { body: { duration } })
    return entry
  },

  addRelation: async (taskId, relatedTaskId, type) => {
    await api.post(`/tasks/${taskId}/relations`, { body: { relatedTaskId, type } })
  },

  createChecklist: async (taskId, title) => {
    await api.post(`/tasks/${taskId}/checklists`, { body: { title } })
  },

  clearDetail: () => set({ taskDetail: null }),
}))
