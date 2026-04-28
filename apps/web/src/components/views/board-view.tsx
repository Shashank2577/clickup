'use client'

import { useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
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
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  StaggerList,
  StaggerItem,
  InteractiveCard,
  springs,
  Skeleton,
} from '@/components/motion'
import { useTaskStore, useWorkspaceStore, useUIStore } from '@/stores'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'

const priorityConfig: Record<string, string> = {
  urgent: 'text-priority-urgent',
  high: 'text-priority-high',
  normal: 'text-priority-normal',
  low: 'text-priority-low',
  none: 'text-muted-foreground/30',
}

export function BoardView() {
  // === WIRING: get listId from URL params ===
  const params = useParams<{ listId?: string }>()

  // === WIRING: task store for CRUD and loading ===
  const { tasks, isLoading, loadTasks, createTask } = useTaskStore()

  // === WIRING: workspace store for fallback listId ===
  const spaces = useWorkspaceStore((s) => s.spaces)

  // === WIRING: UI store for opening task detail on card click ===
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const loadTaskDetail = useTaskStore((s) => s.loadTaskDetail)

  const firstListId = params?.listId ?? spaces[0]?.lists[0]?.id

  // === WIRING: load tasks on mount grouped by status ===
  useEffect(() => {
    if (firstListId) {
      loadTasks(firstListId, 'status')
    }
  }, [firstListId, loadTasks])

  // === WIRING: group store tasks into status columns ===
  const columns = useMemo(() => {
    const statuses: TaskStatus[] = [
      'todo',
      'in-progress',
      'in-review',
      'done',
      'closed',
    ]
    return statuses.map((status) => ({
      status,
      label: status.replace('-', ' ').toUpperCase(),
      tasks: tasks.filter((t) => t.status === status),
    }))
  }, [tasks])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
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
          {/* === WIRING: top-level "+ Add Task" creates task in first column === */}
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

      {/* Board columns */}
      {/* === WIRING: Skeleton cards for loading state === */}
      {isLoading ? (
        <div className="p-4 flex gap-3">
          <Skeleton className="h-60 w-[280px]" />
          <Skeleton className="h-60 w-[280px]" />
          <Skeleton className="h-60 w-[280px]" />
        </div>
      ) : (
        <StaggerList className="flex-1 flex gap-3 overflow-x-auto p-4 scrollbar-thin">
          {columns.map((column) => (
            <StaggerItem key={column.status}>
              <div className="flex min-w-[280px] max-w-[320px] flex-col">
                {/* Column header with status badge */}
                <div className="flex items-center gap-2 px-2 py-2">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={springs.snappy}
                  >
                    <Badge
                      variant={
                        column.status === 'todo'
                          ? 'todo'
                          : column.status === 'in-progress'
                            ? 'in-progress'
                            : column.status === 'in-review'
                              ? 'in-review'
                              : column.status === 'done'
                                ? 'done'
                                : 'closed'
                      }
                    >
                      {column.label}
                    </Badge>
                  </motion.div>
                  <span className="text-xs text-muted-foreground">
                    {column.tasks.length}
                  </span>
                </div>

                {/* Task cards in column */}
                <StaggerList className="flex-1 space-y-2 px-1 pb-4 overflow-y-auto scrollbar-thin">
                  {column.tasks.map((task) => (
                    <StaggerItem key={task.id}>
                      {/* === WIRING: card click opens task detail === */}
                      <InteractiveCard
                        className="rounded-lg border border-border bg-card p-3 shadow-sm cursor-pointer group"
                        onClick={() => {
                          openTaskDetail(task.id)
                          loadTaskDetail(task.id)
                        }}
                      >
                        <h4 className="text-sm font-medium mb-2">
                          {task.title}
                        </h4>

                        <div className="flex items-center gap-2 mb-1.5">
                          <Flag
                            className={cn(
                              'h-3 w-3',
                              priorityConfig[task.priority]
                            )}
                          />
                          {task.dueDate && (
                            <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {task.subtaskCount > 0 && (
                          <div className="flex items-center gap-1 text-2xs text-muted-foreground mt-2">
                            <ChevronDown className="h-3 w-3" />
                            <GitBranch className="h-3 w-3" />
                            {task.subtaskCount} subtasks
                          </div>
                        )}
                      </InteractiveCard>
                    </StaggerItem>
                  ))}

                  {/* === WIRING: per-column "+ Add Task" creates task with that column's status === */}
                  <StaggerItem>
                    <motion.button
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-2 text-sm text-muted-foreground transition-colors"
                      whileHover={{
                        borderColor: 'hsl(var(--primary))',
                        borderStyle: 'solid',
                        color: 'hsl(var(--foreground))',
                        backgroundColor: 'hsl(var(--accent) / 0.5)',
                        transition: { duration: 0.15 },
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        firstListId &&
                        createTask({
                          title: `New ${column.label} Task`,
                          listId: firstListId,
                          status: column.status,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Task
                    </motion.button>
                  </StaggerItem>
                </StaggerList>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}
