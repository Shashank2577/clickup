'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Plus,
  Share2,
  MoreHorizontal,
  GripVertical,
  BarChart3,
  PieChart,
  ListTodo,
  Users,
  Clock,
  TrendingDown,
  LayoutDashboard,
  CheckCircle2,
  Circle,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  FadeIn,
  StaggerList,
  StaggerItem,
  InteractiveCard,
  springs,
} from '@/components/motion'

// Types
interface Widget {
  id: string
  type: 'status-distribution' | 'task-list' | 'workload' | 'burndown' | 'time-tracking'
  title: string
  span?: number
}

interface WidgetTask {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  assignee: string
  assigneeInitial: string
  assigneeColor: string
}

interface WorkloadMember {
  name: string
  initial: string
  color: string
  hours: number
  capacity: number
}

// Demo data
const demoWidgets: Widget[] = [
  { id: 'w1', type: 'status-distribution', title: 'Status Distribution' },
  { id: 'w2', type: 'task-list', title: 'Task List' },
  { id: 'w3', type: 'workload', title: 'Team Workload' },
  { id: 'w4', type: 'burndown', title: 'Sprint Burndown' },
  { id: 'w5', type: 'time-tracking', title: 'Time Tracking' },
]

const statusDistribution = [
  { status: 'To Do', count: 12, color: 'bg-status-todo', pct: 30 },
  { status: 'In Progress', count: 8, color: 'bg-status-in-progress', pct: 20 },
  { status: 'In Review', count: 4, color: 'bg-status-in-review', pct: 10 },
  { status: 'Done', count: 14, color: 'bg-status-done', pct: 35 },
  { status: 'Closed', count: 2, color: 'bg-status-closed', pct: 5 },
]

const widgetTasks: WidgetTask[] = [
  { id: 't1', title: 'Implement user authentication flow', status: 'in-progress', assignee: 'Shashank', assigneeInitial: 'S', assigneeColor: 'bg-primary' },
  { id: 't2', title: 'Design dashboard widget system', status: 'in-progress', assignee: 'Taylor', assigneeInitial: 'T', assigneeColor: 'bg-orange-500' },
  { id: 't3', title: 'Write API documentation', status: 'todo', assignee: 'Alex', assigneeInitial: 'A', assigneeColor: 'bg-green-500' },
  { id: 't4', title: 'Set up CI/CD pipeline', status: 'done', assignee: 'Jordan', assigneeInitial: 'J', assigneeColor: 'bg-purple-500' },
  { id: 't5', title: 'Implement WebSocket layer', status: 'todo', assignee: 'Morgan', assigneeInitial: 'M', assigneeColor: 'bg-pink-500' },
]

const workloadMembers: WorkloadMember[] = [
  { name: 'Shashank', initial: 'S', color: 'bg-primary', hours: 34, capacity: 40 },
  { name: 'Alex', initial: 'A', color: 'bg-green-500', hours: 28, capacity: 40 },
  { name: 'Jordan', initial: 'J', color: 'bg-purple-500', hours: 38, capacity: 40 },
  { name: 'Taylor', initial: 'T', color: 'bg-orange-500', hours: 22, capacity: 32 },
  { name: 'Morgan', initial: 'M', color: 'bg-pink-500', hours: 30, capacity: 40 },
]

const burndownData = [
  { day: 'Mon', ideal: 40, actual: 40 },
  { day: 'Tue', ideal: 34, actual: 36 },
  { day: 'Wed', ideal: 28, actual: 30 },
  { day: 'Thu', ideal: 22, actual: 26 },
  { day: 'Fri', ideal: 16, actual: 20 },
  { day: 'Sat', ideal: 10, actual: 16 },
  { day: 'Sun', ideal: 4, actual: 12 },
]

const timeEntries = [
  { day: 'Mon', hours: 7.5 },
  { day: 'Tue', hours: 8.2 },
  { day: 'Wed', hours: 6.8 },
  { day: 'Thu', hours: 9.1 },
  { day: 'Fri', hours: 7.0 },
]

const statusIcons: Record<string, React.ReactNode> = {
  'todo': <Circle className="h-3 w-3 text-status-todo" />,
  'in-progress': <Clock className="h-3 w-3 text-status-in-progress" />,
  'done': <CheckCircle2 className="h-3 w-3 text-status-done" />,
}

function WidgetHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <button className="rounded p-1 hover:bg-accent transition-colors opacity-0 group-hover:opacity-100">
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

function StatusDistributionWidget() {
  const total = statusDistribution.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <WidgetHeader title="Status Distribution" />
      {/* Donut chart placeholder */}
      <div className="flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            {statusDistribution.reduce<{ elements: React.ReactNode[]; offset: number }>((acc, item, i) => {
              const circumference = 2 * Math.PI * 40
              const dash = (item.pct / 100) * circumference
              const gap = circumference - dash
              acc.elements.push(
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="12"
                  className={item.color.replace('bg-', 'stroke-')}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-acc.offset}
                  strokeLinecap="round"
                />
              )
              acc.offset += dash
              return acc
            }, { elements: [], offset: 0 }).elements}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{total}</span>
            <span className="text-2xs text-muted-foreground">tasks</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {statusDistribution.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', item.color)} />
              <span className="text-xs flex-1">{item.status}</span>
              <span className="text-xs font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TaskListWidget() {
  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <WidgetHeader title="Task List" />
      <div className="space-y-1">
        {widgetTasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-accent/50 cursor-pointer transition-colors">
            {statusIcons[task.status]}
            <span className="flex-1 text-xs truncate">{task.title}</span>
            <Avatar className="h-5 w-5">
              <AvatarFallback className={cn('text-[9px]', task.assigneeColor)}>{task.assigneeInitial}</AvatarFallback>
            </Avatar>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkloadWidget() {
  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <WidgetHeader title="Team Workload" />
      <div className="space-y-3">
        {workloadMembers.map((member) => {
          const pct = Math.round((member.hours / member.capacity) * 100)
          const isOver = pct > 90
          return (
            <div key={member.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className={cn('text-[9px]', member.color)}>{member.initial}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{member.name}</span>
                </div>
                <span className={cn('text-2xs font-medium', isOver ? 'text-destructive' : 'text-muted-foreground')}>
                  {member.hours}h / {member.capacity}h
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', isOver ? 'bg-destructive' : pct > 75 ? 'bg-yellow-500' : 'bg-primary')}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BurndownWidget() {
  const maxVal = 40
  const chartH = 120
  const chartW = 220
  const padding = 20

  function yPos(val: number) {
    return padding + ((maxVal - val) / maxVal) * (chartH - 2 * padding)
  }

  function xPos(i: number) {
    return padding + (i / (burndownData.length - 1)) * (chartW - 2 * padding)
  }

  const idealPath = burndownData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(d.ideal)}`).join(' ')
  const actualPath = burndownData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(d.actual)}`).join(' ')

  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <WidgetHeader title="Sprint Burndown" />
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-muted-foreground/30 rounded" />
          <span className="text-2xs text-muted-foreground">Ideal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary rounded" />
          <span className="text-2xs text-muted-foreground">Actual</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 10, 20, 30, 40].map((val) => (
          <g key={val}>
            <line x1={padding} y1={yPos(val)} x2={chartW - padding} y2={yPos(val)} stroke="hsl(var(--border))" strokeWidth="0.5" />
            <text x={padding - 4} y={yPos(val) + 3} textAnchor="end" className="fill-muted-foreground text-[6px]">{val}</text>
          </g>
        ))}
        {/* Day labels */}
        {burndownData.map((d, i) => (
          <text key={d.day} x={xPos(i)} y={chartH - 4} textAnchor="middle" className="fill-muted-foreground text-[6px]">{d.day}</text>
        ))}
        {/* Ideal line */}
        <path d={idealPath} fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Actual line */}
        <motion.path
          d={actualPath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {/* Actual dots */}
        {burndownData.map((d, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(d.actual)} r="2.5" className="fill-primary" />
        ))}
      </svg>
    </div>
  )
}

function TimeTrackingWidget() {
  const maxHours = Math.max(...timeEntries.map((e) => e.hours))
  const totalWeek = timeEntries.reduce((s, e) => s + e.hours, 0)

  return (
    <div className="group rounded-lg border border-border bg-card p-4">
      <WidgetHeader title="Time Tracking" />
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold">{totalWeek.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">hours this week</span>
      </div>
      <div className="flex items-end gap-2 h-20">
        {timeEntries.map((entry) => {
          const pct = (entry.hours / maxHours) * 100
          return (
            <div key={entry.day} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-full rounded-t bg-primary/80 min-h-[4px]"
              />
              <span className="text-2xs text-muted-foreground">{entry.day}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-2xs text-muted-foreground">Avg: {(totalWeek / timeEntries.length).toFixed(1)}h/day</span>
        <span className="text-2xs text-muted-foreground">Target: 8h/day</span>
      </div>
    </div>
  )
}

export function DashboardView({ dashboardId }: { dashboardId: string }) {
  const [title, setTitle] = useState('Sprint Overview')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <Plus className="h-3 w-3" />
            Add Widget
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <Share2 className="h-3 w-3" />
            Share
          </Button>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Widget grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StaggerItem>
            <StatusDistributionWidget />
          </StaggerItem>
          <StaggerItem>
            <TaskListWidget />
          </StaggerItem>
          <StaggerItem>
            <WorkloadWidget />
          </StaggerItem>
          <StaggerItem>
            <BurndownWidget />
          </StaggerItem>
          <StaggerItem>
            <TimeTrackingWidget />
          </StaggerItem>
        </StaggerList>
      </div>
    </div>
  )
}
