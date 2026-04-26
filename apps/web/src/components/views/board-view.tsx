'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Filter,
  Search,
  User,
  Flag,
  Calendar,
  GitBranch,
  ChevronDown,
  MoreHorizontal,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'

interface BoardTask {
  id: string
  title: string
  parentTitle?: string
  priority: 'urgent' | 'high' | 'normal' | 'low' | 'none'
  dateRange?: string
  subtaskCount?: number
  assignee?: string
}

interface BoardColumn {
  status: TaskStatus
  label: string
  count: number
  tasks: BoardTask[]
}

const statusColors: Record<TaskStatus, string> = {
  'todo': 'bg-status-todo',
  'in-progress': 'bg-status-in-progress',
  'in-review': 'bg-status-in-review',
  'done': 'bg-status-done',
  'closed': 'bg-status-closed',
}

const priorityConfig: Record<string, string> = {
  urgent: 'text-priority-urgent',
  high: 'text-priority-high',
  normal: 'text-priority-normal',
  low: 'text-priority-low',
  none: 'text-muted-foreground/30',
}

const demoColumns: BoardColumn[] = [
  {
    status: 'todo',
    label: 'TO DO',
    count: 2,
    tasks: [
      {
        id: '1',
        title: 'Product Launch Campaign',
        priority: 'normal',
        dateRange: 'Jun 1 - Jul 21',
        subtaskCount: 2,
      },
      {
        id: '1a',
        title: 'Social Media Assets',
        parentTitle: 'Product Launch Campaign',
        priority: 'none',
      },
      {
        id: '1b',
        title: 'Press Release Draft',
        parentTitle: 'Product Launch Campaign',
        priority: 'none',
      },
      {
        id: '3',
        title: 'Beta Testing Program',
        priority: 'high',
        dateRange: 'Jun 20 - Jul 2',
        subtaskCount: 2,
      },
    ],
  },
  {
    status: 'in-progress',
    label: 'IN PROGRESS',
    count: 1,
    tasks: [
      {
        id: '2',
        title: 'Mobile App MVP Development',
        priority: 'urgent',
        dateRange: 'Apr 15 - Jun 16',
        subtaskCount: 3,
      },
      {
        id: '2a',
        title: 'Database Schema Design',
        parentTitle: 'Mobile App MVP Development',
        priority: 'none',
      },
      {
        id: '2b',
        title: 'API Integration',
        parentTitle: 'Mobile App MVP Development',
        priority: 'none',
      },
      {
        id: '2c',
        title: 'UI Component Library',
        parentTitle: 'Mobile App MVP Development',
        priority: 'none',
      },
    ],
  },
  {
    status: 'in-review',
    label: 'IN REVIEW',
    count: 0,
    tasks: [],
  },
  {
    status: 'done',
    label: 'DONE',
    count: 1,
    tasks: [
      {
        id: '4',
        title: 'Market Research & Analysis',
        priority: 'normal',
        dateRange: 'Apr 1 - May 11',
        subtaskCount: 2,
      },
      {
        id: '4a',
        title: 'Competitor Benchmarking',
        parentTitle: 'Market Research & Analysis',
        priority: 'none',
      },
      {
        id: '4b',
        title: 'User Survey Distribution',
        parentTitle: 'Market Research & Analysis',
        priority: 'none',
      },
    ],
  },
  {
    status: 'closed',
    label: 'COMPLETED',
    count: 0,
    tasks: [],
  },
]

function BoardToolbar() {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Group: Status
        </Button>
        <Button variant="ghost" size="sm" className="text-xs">
          <Eye className="mr-1 h-3 w-3" />
          Expanded
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Flag className="h-3 w-3" />
          Priority
        </Button>
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

function TaskCard({ task }: { task: BoardTask }) {
  const isParent = !task.parentTitle
  const priorityColor = priorityConfig[task.priority]

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
      {task.parentTitle && (
        <p className="text-2xs text-muted-foreground mb-1 truncate">
          {task.parentTitle}
        </p>
      )}
      <h4 className="text-sm font-medium mb-2">{task.title}</h4>

      {isParent && (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <Flag className={cn('h-3 w-3', priorityColor)} />
            {task.dateRange && (
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {task.dateRange}
              </span>
            )}
          </div>
          {task.subtaskCount && task.subtaskCount > 0 && (
            <div className="flex items-center gap-1 text-2xs text-muted-foreground mt-2">
              <ChevronDown className="h-3 w-3" />
              <GitBranch className="h-3 w-3" />
              {task.subtaskCount} subtasks
            </div>
          )}
        </>
      )}

      {!isParent && (
        <div className="flex items-center gap-1.5">
          <Flag className={cn('h-3 w-3', priorityColor)} />
          <Calendar className="h-3 w-3 text-muted-foreground/30" />
        </div>
      )}
    </div>
  )
}

function BoardColumnComponent({ column }: { column: BoardColumn }) {
  return (
    <div className="flex min-w-[280px] max-w-[320px] flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Badge variant={column.status === 'todo' ? 'todo' : column.status === 'in-progress' ? 'in-progress' : column.status === 'in-review' ? 'in-review' : column.status === 'done' ? 'done' : 'closed'}>
          {column.label}
        </Badge>
        <span className="text-xs text-muted-foreground">{column.count}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 px-1 pb-4 overflow-y-auto scrollbar-thin">
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}

        {/* Add task */}
        <button className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </button>
      </div>
    </div>
  )
}

export function BoardView() {
  return (
    <div className="h-full flex flex-col">
      <BoardToolbar />
      <div className="flex-1 flex gap-3 overflow-x-auto p-4 scrollbar-thin">
        {demoColumns.map((column) => (
          <BoardColumnComponent key={column.status} column={column} />
        ))}

        {/* Add group button */}
        <div className="min-w-[200px]">
          <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add group
          </button>
        </div>
      </div>
    </div>
  )
}
