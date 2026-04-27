'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Flag,
  Calendar,
  GitBranch,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FadeIn,
  StaggerList,
  StaggerItem,
  InteractiveRow,
  TabContent,
  Skeleton,
  motion,
  springs,
} from '@/components/motion'
import { useAuthStore, useTaskStore } from '@/stores'

// === WIRING: status icon map with ALL 5 statuses including 'closed' ===
const statusIcon: Record<string, React.ReactNode> = {
  'todo': <Circle className="h-3.5 w-3.5 text-status-todo" />,
  'in-progress': <Clock className="h-3.5 w-3.5 text-status-in-progress" />,
  'in-review': <GitBranch className="h-3.5 w-3.5 text-status-in-review" />,
  'done': <CheckCircle2 className="h-3.5 w-3.5 text-status-done" />,
  'closed': <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
}

const priorityColor: Record<string, string> = {
  urgent: 'text-priority-urgent',
  high: 'text-priority-high',
  normal: 'text-priority-normal',
  low: 'text-priority-low',
  none: 'text-muted-foreground',
}

type TabId = 'todo' | 'done' | 'delegated'

// === WIRING: time-based greeting using user's first name ===
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// === WIRING: demo data as fallback when store is empty ===
const demoTasks = [
  { id: 'demo-1', title: 'Set up project structure', status: 'todo' as const, priority: 'high' as const, dueDate: new Date().toISOString(), listId: 'demo', assignees: [], tags: [], subtaskCount: 0, customFields: {}, createdAt: '', updatedAt: '', breadcrumb: 'Engineering · Sprint 1' },
  { id: 'demo-2', title: 'Design system components', status: 'in-progress' as const, priority: 'normal' as const, dueDate: new Date(Date.now() + 86400000).toISOString(), listId: 'demo', assignees: [], tags: [], subtaskCount: 2, customFields: {}, createdAt: '', updatedAt: '', breadcrumb: 'Design · Components' },
  { id: 'demo-3', title: 'API integration testing', status: 'todo' as const, priority: 'urgent' as const, dueDate: new Date(Date.now() - 86400000).toISOString(), listId: 'demo', assignees: [], tags: [], subtaskCount: 0, customFields: {}, createdAt: '', updatedAt: '', breadcrumb: 'Engineering · Testing' },
]

export function MyTasksView() {
  // === WIRING: auth store for user name ===
  const user = useAuthStore((s) => s.user)

  // === WIRING: task store for tasks and loading state ===
  const { tasks, isLoading, loadMyTasks } = useTaskStore()

  const [activeTab, setActiveTab] = useState<TabId>('todo')

  // === WIRING: load my tasks on mount with dueDate grouping ===
  useEffect(() => {
    loadMyTasks('dueDate')
  }, [loadMyTasks])

  // Use store tasks or demo fallback
  const activeTasks = tasks.length > 0 ? tasks : demoTasks

  // === WIRING: filter tasks by active tab ===
  const filteredTasks = useMemo(() => {
    switch (activeTab) {
      case 'todo':
        return activeTasks.filter(
          (t) => t.status !== 'done' && t.status !== 'closed'
        )
      case 'done':
        return activeTasks.filter(
          (t) => t.status === 'done' || t.status === 'closed'
        )
      case 'delegated':
        // Delegated = tasks assigned to others (placeholder: show tasks with assignees)
        return activeTasks.filter((t) => t.assignees.length > 1)
      default:
        return activeTasks
    }
  }, [activeTasks, activeTab])

  // === WIRING: group tasks by due date comparison (Today, Overdue, Next, Unscheduled) ===
  const taskGroups = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 86400000)

    const overdue: typeof filteredTasks = []
    const todayGroup: typeof filteredTasks = []
    const next: typeof filteredTasks = []
    const unscheduled: typeof filteredTasks = []

    for (const task of filteredTasks) {
      if (!task.dueDate) {
        unscheduled.push(task)
        continue
      }
      const due = new Date(task.dueDate)
      if (due < today) {
        overdue.push(task)
      } else if (due < tomorrow) {
        todayGroup.push(task)
      } else {
        next.push(task)
      }
    }

    return [
      { label: 'Overdue', tasks: overdue, color: 'text-red-500' },
      { label: 'Today', tasks: todayGroup, color: 'text-foreground' },
      { label: 'Next', tasks: next, color: 'text-muted-foreground' },
      { label: 'Unscheduled', tasks: unscheduled, color: 'text-muted-foreground' },
    ].filter((g) => g.tasks.length > 0)
  }, [filteredTasks])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'done', label: 'Done' },
    { id: 'delegated', label: 'Delegated' },
  ]

  const firstName = user?.fullName?.split(' ')[0] ?? 'there'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">My Tasks</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Manage cards
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* === WIRING: time-based greeting with user's first name === */}
        <FadeIn>
          <h2 className="text-2xl font-bold mb-6">
            {greeting()}, {firstName}
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Work card */}
          <div className="lg:col-span-2">
            <FadeIn delay={0.05}>
              <div className="rounded-lg border border-border">
                {/* Tab bar */}
                <div className="flex items-center border-b border-border px-4">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'relative px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent',
                        activeTab === tab.id
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="myTasksTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                          transition={springs.snappy}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Task list */}
                <TabContent activeKey={activeTab} className="p-4">
                  {/* === WIRING: loading state with Skeleton rows === */}
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : taskGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No tasks in this view
                      </p>
                    </div>
                  ) : (
                    <StaggerList className="space-y-4">
                      {taskGroups.map((group) => (
                        <StaggerItem key={group.label}>
                          {/* Group header */}
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                'text-xs font-semibold uppercase tracking-wider',
                                group.color
                              )}
                            >
                              {group.label}
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              {group.tasks.length}
                            </span>
                          </div>

                          {/* Task rows */}
                          <div className="space-y-0.5">
                            {group.tasks.map((task) => (
                              <InteractiveRow
                                key={task.id}
                                className="group flex items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer"
                              >
                                {/* === WIRING: status icon for each task === */}
                                {statusIcon[task.status] ?? (
                                  <Circle className="h-3.5 w-3.5" />
                                )}

                                {/* Task title */}
                                <span className="flex-1 text-sm truncate">
                                  {task.title}
                                </span>

                                {/* Space · List breadcrumb */}
                                {'breadcrumb' in task && (
                                  <span className="text-2xs text-muted-foreground hidden sm:block">
                                    {(task as { breadcrumb: string }).breadcrumb}
                                  </span>
                                )}

                                {/* Due date */}
                                <span className="text-2xs text-muted-foreground whitespace-nowrap">
                                  {task.dueDate
                                    ? new Date(task.dueDate).toLocaleDateString(
                                        undefined,
                                        { month: 'short', day: 'numeric' }
                                      )
                                    : 'No date'}
                                </span>

                                {/* Priority flag */}
                                <Flag
                                  className={cn(
                                    'h-3 w-3',
                                    priorityColor[task.priority]
                                  )}
                                />

                                {/* Calendar icon (static) */}
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground/30" />
                              </InteractiveRow>
                            ))}
                          </div>
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  )}
                </TabContent>
              </div>
            </FadeIn>
          </div>

          {/* Right sidebar cards */}
          <div className="space-y-6">
            {/* === WIRING: Recents card with Skeleton placeholders === */}
            <FadeIn delay={0.1}>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Recents</h3>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-5/6" />
                </div>
              </div>
            </FadeIn>

            {/* === WIRING: Agenda card with calendar connect buttons (static) === */}
            <FadeIn delay={0.15}>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Agenda</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Connect your calendar to see upcoming events alongside your
                  tasks.
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <Calendar className="mr-1.5 h-3 w-3" />
                    Connect Google Calendar
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <Calendar className="mr-1.5 h-3 w-3" />
                    Connect Outlook
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  )
}
