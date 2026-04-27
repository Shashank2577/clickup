'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  GripVertical,
  Flag,
  Circle,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerList, StaggerItem, InteractiveCard, motion } from '@/components/motion'

type ViewMode = 'month' | 'week' | 'day'

interface PlannerTask {
  id: string
  title: string
  dueDate: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  color: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const statusIcon = {
  todo: <Circle className="h-3 w-3 text-status-todo" />,
  'in-progress': <Clock className="h-3 w-3 text-status-in-progress" />,
  done: <CheckCircle2 className="h-3 w-3 text-status-done" />,
}

const priorityColor = {
  urgent: 'border-l-priority-urgent',
  high: 'border-l-priority-high',
  normal: 'border-l-priority-normal',
  low: 'border-l-priority-low',
}

// Demo tasks
const demoTasks: PlannerTask[] = [
  { id: '1', title: 'Sprint planning meeting', dueDate: '2026-04-27', status: 'todo', priority: 'high', color: 'bg-primary/10' },
  { id: '2', title: 'Review PRs', dueDate: '2026-04-27', status: 'in-progress', priority: 'normal', color: 'bg-blue-500/10' },
  { id: '3', title: 'Deploy v2.1', dueDate: '2026-04-28', status: 'todo', priority: 'urgent', color: 'bg-red-500/10' },
  { id: '4', title: 'Update documentation', dueDate: '2026-04-29', status: 'todo', priority: 'low', color: 'bg-green-500/10' },
  { id: '5', title: 'Team standup', dueDate: '2026-04-30', status: 'done', priority: 'normal', color: 'bg-primary/10' },
  { id: '6', title: 'Design review', dueDate: '2026-05-01', status: 'todo', priority: 'high', color: 'bg-yellow-500/10' },
  { id: '7', title: 'Client presentation', dueDate: '2026-05-02', status: 'todo', priority: 'urgent', color: 'bg-red-500/10' },
  { id: '8', title: 'Database migration', dueDate: '2026-05-04', status: 'in-progress', priority: 'high', color: 'bg-orange-500/10' },
]

const unscheduledTasks: PlannerTask[] = [
  { id: 'u1', title: 'Refactor auth module', dueDate: '', status: 'todo', priority: 'normal', color: 'bg-primary/10' },
  { id: 'u2', title: 'Write unit tests', dueDate: '', status: 'todo', priority: 'high', color: 'bg-blue-500/10' },
  { id: 'u3', title: 'Update onboarding flow', dueDate: '', status: 'todo', priority: 'low', color: 'bg-green-500/10' },
  { id: 'u4', title: 'Performance audit', dueDate: '', status: 'todo', priority: 'urgent', color: 'bg-red-500/10' },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function PlannerView() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const tasksByDate = useMemo(() => {
    const map: Record<string, PlannerTask[]> = {}
    for (const task of demoTasks) {
      if (!map[task.dueDate]) map[task.dueDate] = []
      map[task.dueDate].push(task)
    }
    return map
  }, [])

  function goToToday() {
    setCurrentDate(new Date())
  }

  function navigate(direction: -1 | 1) {
    const d = new Date(currentDate)
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + direction)
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + direction * 7)
    } else {
      d.setDate(d.getDate() + direction)
    }
    setCurrentDate(d)
  }

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  // Build calendar grid
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  return (
    <div className="flex h-full">
      {/* Left panel: Unscheduled tasks */}
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3">Unscheduled</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Drag tasks to the calendar to schedule them
          </p>
          <StaggerList className="space-y-2">
            {unscheduledTasks.map((task) => (
              <StaggerItem key={task.id}>
                <div
                  className={cn(
                    'group flex items-start gap-2 rounded-md border border-border border-l-2 p-2 cursor-grab hover:shadow-sm transition-shadow',
                    priorityColor[task.priority]
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {statusIcon[task.status]}
                      <span className="text-xs font-medium truncate">{task.title}</span>
                    </div>
                    <span className="text-2xs text-muted-foreground capitalize">{task.priority}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </div>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">Planner</h1>
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors capitalize',
                      viewMode === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center">
                  {MONTHS[month]} {year}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>

              {/* Connect calendar buttons */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <span className="h-3 w-3 rounded bg-blue-500" />
                  Google Calendar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <span className="h-3 w-3 rounded bg-blue-700" />
                  Outlook
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === 'month' && (
            <motion.div
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 border-t border-l border-border">
                {calendarDays.map((day, i) => {
                  const dateKey = day ? formatDateKey(year, month, day) : ''
                  const dayTasks = day ? tasksByDate[dateKey] || [] : []
                  return (
                    <div
                      key={i}
                      className={cn(
                        'min-h-[100px] border-r border-b border-border p-1.5',
                        day === null && 'bg-muted/30',
                        isToday(day ?? 0) && 'bg-primary/5'
                      )}
                    >
                      {day !== null && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                                isToday(day)
                                  ? 'bg-primary text-primary-foreground font-bold'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {day}
                            </span>
                            {dayTasks.length === 0 && (
                              <button className="opacity-0 group-hover:opacity-100 hover:opacity-100">
                                <Plus className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayTasks.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-2xs font-medium truncate cursor-pointer hover:opacity-80 transition-opacity',
                                  task.color
                                )}
                              >
                                {task.title}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {viewMode === 'week' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <WeekView currentDate={currentDate} tasksByDate={tasksByDate} />
            </motion.div>
          )}

          {viewMode === 'day' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DayView currentDate={currentDate} tasksByDate={tasksByDate} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function WeekView({
  currentDate,
  tasksByDate,
}: {
  currentDate: Date
  tasksByDate: Record<string, PlannerTask[]>
}) {
  const today = new Date()
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    return d
  })

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="overflow-auto">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-10">
        <div />
        {weekDays.map((d) => {
          const isTodayDate =
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
          return (
            <div key={d.toISOString()} className="px-2 py-2 text-center border-l border-border">
              <div className="text-xs text-muted-foreground">{DAYS[d.getDay()]}</div>
              <div
                className={cn(
                  'text-lg font-semibold',
                  isTodayDate && 'text-primary'
                )}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="pr-2 pt-1 text-right text-2xs text-muted-foreground border-b border-border h-12">
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
            {weekDays.map((d) => {
              const dateKey = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate())
              const dayTasks = tasksByDate[dateKey] || []
              return (
                <div
                  key={d.toISOString()}
                  className="border-l border-b border-border h-12 relative"
                >
                  {hour === 9 &&
                    dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'absolute inset-x-0.5 rounded px-1 py-0.5 text-2xs font-medium truncate',
                          task.color
                        )}
                      >
                        {task.title}
                      </div>
                    ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayView({
  currentDate,
  tasksByDate,
}: {
  currentDate: Date
  tasksByDate: Record<string, PlannerTask[]>
}) {
  const dateKey = formatDateKey(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  )
  const dayTasks = tasksByDate[dateKey] || []
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {DAYS[currentDate.getDay()]}, {MONTHS[currentDate.getMonth()]} {currentDate.getDate()}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <div className="space-y-0">
        {hours.map((hour) => (
          <div key={hour} className="flex border-b border-border/50">
            <div className="w-16 shrink-0 pr-2 pt-1 text-right text-xs text-muted-foreground h-14">
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
            <div className="flex-1 border-l border-border h-14 pl-2 relative">
              {hour === 9 &&
                dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'rounded-md border-l-2 px-2 py-1 mb-1',
                      task.color,
                      priorityColor[task.priority]
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {statusIcon[task.status]}
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
