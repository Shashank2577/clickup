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
