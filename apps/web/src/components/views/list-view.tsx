'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  Search,
  Settings,
  ArrowUpDown,
  Eye,
  Flag,
  User,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  GitBranch,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  assignee?: string
  effort?: string
  subtaskCount?: number
  subtasks?: Task[]
}

interface TaskGroup {
  name: string
  tasks: Task[]
}

// Status config
const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; variant: 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed' }> = {
  'todo': { icon: <Circle className="h-3.5 w-3.5" />, label: 'TO DO', variant: 'todo' },
  'in-progress': { icon: <Clock className="h-3.5 w-3.5" />, label: 'IN PROGRESS', variant: 'in-progress' },
  'in-review': { icon: <GitBranch className="h-3.5 w-3.5" />, label: 'IN REVIEW', variant: 'in-review' },
  'done': { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'DONE', variant: 'done' },
  'closed': { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'COMPLETED', variant: 'closed' },
}

const priorityConfig: Record<TaskPriority, { color: string; label: string }> = {
  urgent: { color: 'text-priority-urgent', label: 'Urgent' },
  high: { color: 'text-priority-high', label: 'High' },
  normal: { color: 'text-priority-normal', label: 'Normal' },
  low: { color: 'text-priority-low', label: 'Low' },
  none: { color: 'text-muted-foreground', label: 'None' },
}

// Demo data
const demoGroups: TaskGroup[] = [
  {
    name: 'Empty',
    tasks: [
      {
        id: '1',
        title: 'Market Research & Analysis',
        status: 'done',
        priority: 'normal',
        dueDate: '5/11/26',
        subtaskCount: 2,
        subtasks: [
          { id: '1a', title: 'Competitor Benchmarking', status: 'done', priority: 'none' },
          { id: '1b', title: 'User Survey Distribution', status: 'done', priority: 'none' },
        ],
      },
      {
        id: '2',
        title: 'Mobile App MVP Development',
        status: 'in-progress',
        priority: 'urgent',
        dueDate: '6/16/26',
        subtaskCount: 3,
        subtasks: [
          { id: '2a', title: 'Database Schema Design', status: 'done', priority: 'none' },
          { id: '2b', title: 'API Integration', status: 'in-progress', priority: 'none' },
          { id: '2c', title: 'UI Component Library', status: 'in-progress', priority: 'none' },
        ],
      },
      {
        id: '3',
        title: 'Beta Testing Program',
        status: 'todo',
        priority: 'high',
        dueDate: '7/2/26',
        subtaskCount: 2,
        subtasks: [
          { id: '3a', title: 'Draft Recruitment Email', status: 'todo', priority: 'none' },
          { id: '3b', title: 'Setup Feedback Form', status: 'todo', priority: 'none' },
        ],
      },
      {
        id: '4',
        title: 'Product Launch Campaign',
        status: 'todo',
        priority: 'normal',
        dueDate: '7/21/26',
        subtaskCount: 2,
        subtasks: [
          { id: '4a', title: 'Social Media Assets', status: 'todo', priority: 'none' },
          { id: '4b', title: 'Press Release Draft', status: 'todo', priority: 'none' },
        ],
      },
    ],
  },
]

// --- Components ---

function ListToolbar() {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Group: Project Phase
        </Button>
        <Button variant="ghost" size="sm" className="text-xs">
          <Eye className="mr-1 h-3 w-3" />
          Expanded
        </Button>
        <Button variant="ghost" size="sm" className="text-xs">
          Columns
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Filter className="h-3 w-3" />
          Filter
        </Button>
        <Button variant="ghost" size="sm" className="text-xs">
          Closed
        </Button>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <User className="h-3 w-3" />
          Assignee
        </Button>
        <Button variant="ghost" size="icon-sm">
          <Search className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs">
          Customize
        </Button>
        <Button size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Task
        </Button>
      </div>
    </div>
  )
}

function ColumnHeaders() {
  return (
    <div className="flex items-center border-b border-border px-4 py-1.5 text-2xs font-medium text-muted-foreground uppercase tracking-wider">
      <div className="flex-1 min-w-0">Name</div>
      <div className="w-24 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-foreground">
        Due date
        <ArrowUpDown className="h-2.5 w-2.5" />
      </div>
      <div className="w-20 text-center">Priority</div>
      <div className="w-16 text-center">Effort</div>
      <div className="w-28 text-center">Status</div>
      <div className="w-20 text-center">Assignee</div>
      <div className="w-8">
        <Settings className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  )
}

function TaskRow({ task, depth = 0 }: { task: Task; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const status = statusConfig[task.status]
  const priority = priorityConfig[task.priority]

  return (
    <>
      <div
        className="group flex items-center border-b border-border/50 px-4 py-1.5 hover:bg-accent/50 transition-colors cursor-pointer"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {hasSubtasks ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span className="flex items-center justify-center">
            {status.icon}
          </span>

          <span className="flex-1 truncate text-sm">{task.title}</span>

          {task.subtaskCount && task.subtaskCount > 0 && (
            <span className="flex items-center gap-0.5 text-2xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {task.subtaskCount}
            </span>
          )}
        </div>

        <div className="w-24 text-center text-xs text-muted-foreground">
          {task.dueDate && (
            <span className="flex items-center justify-center gap-1">
              <Calendar className="h-3 w-3" />
              {task.dueDate}
            </span>
          )}
        </div>

        <div className="w-20 flex justify-center">
          {task.priority !== 'none' && (
            <Flag className={cn('h-3.5 w-3.5', priority.color)} />
          )}
          {task.priority === 'none' && (
            <Flag className="h-3.5 w-3.5 text-muted-foreground/30" />
          )}
        </div>

        <div className="w-16 text-center text-xs text-muted-foreground">
          {task.effort || '–'}
        </div>

        <div className="w-28 flex justify-center">
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="w-20 flex justify-center">
          <User className="h-4 w-4 text-muted-foreground/30" />
        </div>

        <div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="rounded p-0.5 hover:bg-accent">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && task.subtasks!.map((subtask) => (
        <TaskRow key={subtask.id} task={subtask} depth={depth + 1} />
      ))}
    </>
  )
}

function GroupHeader({ group }: { group: TaskGroup }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>{group.name}</span>
        <span className="text-muted-foreground">{group.tasks.length}</span>
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground ml-1 opacity-0 group-hover:opacity-100" />
        <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </button>

      {expanded && (
        <>
          <ColumnHeaders />
          {group.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          <button className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        </>
      )}
    </div>
  )
}

export function ListView() {
  return (
    <div className="h-full flex flex-col">
      <ListToolbar />
      <div className="flex-1 overflow-y-auto">
        {demoGroups.map((group) => (
          <GroupHeader key={group.name} group={group} />
        ))}
      </div>
    </div>
  )
}
