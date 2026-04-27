'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
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
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  AnimatePresence,
  FadeIn,
  InteractiveRow,
  springs,
  Skeleton,
} from '@/components/motion'
import { useTaskStore, useWorkspaceStore, useUIStore } from '@/stores'

// === WIRING: local type aliases matching task-store types ===
type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

type ViewTask = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  effort?: string
  subtaskCount?: number
  subtasks?: ViewTask[]
}

// === WIRING: status config with ALL 5 statuses including 'closed' ===
const statusConfig: Record<
  TaskStatus,
  {
    icon: React.ReactNode
    label: string
    variant: 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'
  }
> = {
  'todo': {
    icon: <Circle className="h-3.5 w-3.5" />,
    label: 'TO DO',
    variant: 'todo',
  },
  'in-progress': {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'IN PROGRESS',
    variant: 'in-progress',
  },
  'in-review': {
    icon: <GitBranch className="h-3.5 w-3.5" />,
    label: 'IN REVIEW',
    variant: 'in-review',
  },
  'done': {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'DONE',
    variant: 'done',
  },
  'closed': {
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'COMPLETED',
    variant: 'closed',
  },
}

const priorityConfig: Record<TaskPriority, { color: string }> = {
  urgent: { color: 'text-priority-urgent' },
  high: { color: 'text-priority-high' },
  normal: { color: 'text-priority-normal' },
  low: { color: 'text-priority-low' },
  none: { color: 'text-muted-foreground' },
}

function TaskRow({ task, depth = 0 }: { task: ViewTask; depth?: number }) {
  const [expanded, setExpanded] = useState(true)

  // === WIRING: task click opens task detail via UI store ===
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const loadTaskDetail = useTaskStore((s) => s.loadTaskDetail)

  const hasSubtasks = (task.subtasks?.length ?? 0) > 0
  const status = statusConfig[task.status]

  return (
    <>
      <InteractiveRow
        className="group flex items-center border-b border-border/50 px-4 py-1.5 cursor-pointer"
        onClick={() => {
          openTaskDetail(task.id)
          loadTaskDetail(task.id)
        }}
      >
        <div
          data-task={task.id}
          className="flex w-full items-center"
          style={{ paddingLeft: `${depth * 24}px` }}
        >
          {/* Left section: expand toggle + status + title */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            {hasSubtasks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(!expanded)
                }}
                className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
              >
                <motion.div
                  animate={{ rotate: expanded ? 0 : -90 }}
                  transition={springs.snappy}
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </motion.div>
              </button>
            ) : (
              <span className="w-4" />
            )}

            <span>{status.icon}</span>

            <span className="flex-1 truncate text-sm">
              {task.title}
            </span>

            {task.subtaskCount ? (
              <span className="flex items-center gap-0.5 text-2xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {task.subtaskCount}
              </span>
            ) : null}
          </div>

          {/* Due date column */}
          <div className="w-24 text-center text-xs text-muted-foreground">
            {task.dueDate ? (
              <span className="flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" />
                {task.dueDate}
              </span>
            ) : null}
          </div>

          {/* Priority column */}
          <div className="w-20 flex justify-center">
            <Flag
              className={cn(
                'h-3.5 w-3.5',
                priorityConfig[task.priority].color
              )}
            />
          </div>

          {/* Effort column */}
          <div className="w-16 text-center text-xs text-muted-foreground">
            {task.effort || '–'}
          </div>

          {/* Status badge column */}
          <div className="w-28 flex justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={springs.snappy}
            >
              <Badge variant={status.variant}>
                {status.label}
              </Badge>
            </motion.div>
          </div>

          {/* Assignee column */}
          <div className="w-20 flex justify-center">
            <User className="h-4 w-4 text-muted-foreground/30" />
          </div>

          {/* Actions column */}
          <div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="rounded p-0.5 hover:bg-accent">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </InteractiveRow>

      {/* Subtask expand/collapse with AnimatePresence */}
      <AnimatePresence initial={false}>
        {expanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
            style={{ overflow: 'hidden' }}
          >
            {task.subtasks!.map((sub) => (
              <TaskRow
                key={sub.id}
                task={sub}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function ListView() {
  // === WIRING: get listId from URL params ===
  const params = useParams<{ listId?: string }>()

  // === WIRING: task store for CRUD operations ===
  const { tasks, isLoading, loadTasks, createTask } = useTaskStore()

  // === WIRING: workspace store for fallback listId ===
  const spaces = useWorkspaceStore((s) => s.spaces)

  const firstListId = params?.listId ?? spaces[0]?.lists[0]?.id

  // === WIRING: load tasks on mount when listId is available ===
  useEffect(() => {
    if (firstListId) {
      loadTasks(firstListId)
    }
  }, [firstListId, loadTasks])

  // === WIRING: group tasks from store (single group for now, expandable) ===
  const groups = useMemo(
    () => [{ name: 'Tasks', tasks: tasks as unknown as ViewTask[] }],
    [tasks]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
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
          {/* === WIRING: "+ Add Task" calls createTask on the store === */}
          <Button
            size="sm"
            className="gap-1"
            onClick={() =>
              firstListId &&
              createTask({ title: 'New Task', listId: firstListId })
            }
          >
            <Plus className="h-3 w-3" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Task list area */}
      <div className="flex-1 overflow-y-auto">
        {/* === WIRING: Skeleton rows for loading state === */}
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.name}>
              {/* Column headers */}
              <FadeIn>
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
              </FadeIn>

              {/* Task rows */}
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}

              {/* Add task button at bottom of group */}
              <motion.button
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() =>
                  firstListId &&
                  createTask({ title: 'New Task', listId: firstListId })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </motion.button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
