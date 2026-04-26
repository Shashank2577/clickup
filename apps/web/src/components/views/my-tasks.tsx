'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Flag,
  Calendar,
  GitBranch,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Sample data matching what we saw in ClickUp
const taskGroups = [
  {
    title: 'Today',
    count: 2,
    tasks: [
      {
        id: '1',
        title: 'Bring Your Team Onboard in Minutes',
        space: 'Team Space',
        list: 'Get Started with ClickUp',
        status: 'todo' as const,
        priority: 'normal' as const,
        dueDate: 'Today',
      },
      {
        id: '2',
        title: 'Import Your Work into ClickUp',
        space: 'Team Space',
        list: 'Get Started with ClickUp',
        status: 'todo' as const,
        priority: 'urgent' as const,
        dueDate: 'Today',
      },
    ],
  },
  {
    title: 'Overdue',
    count: 2,
    tasks: [
      {
        id: '3',
        title: 'Mobile App MVP Development',
        space: 'Space',
        list: 'General Project Manager',
        status: 'in-progress' as const,
        priority: 'urgent' as const,
        dueDate: '6/16/26',
      },
      {
        id: '4',
        title: 'API Integration',
        space: 'Space',
        list: 'General Project Manager',
        status: 'in-progress' as const,
        priority: 'normal' as const,
        dueDate: '6/16/26',
      },
    ],
  },
  {
    title: 'Next',
    count: 2,
    tasks: [],
  },
  {
    title: 'Unscheduled',
    count: 0,
    tasks: [],
  },
]

const statusIcon = {
  'todo': <Circle className="h-3.5 w-3.5 text-status-todo" />,
  'in-progress': <Clock className="h-3.5 w-3.5 text-status-in-progress" />,
  'in-review': <GitBranch className="h-3.5 w-3.5 text-status-in-review" />,
  'done': <CheckCircle2 className="h-3.5 w-3.5 text-status-done" />,
}

const priorityColor = {
  urgent: 'text-priority-urgent',
  high: 'text-priority-high',
  normal: 'text-priority-normal',
  low: 'text-priority-low',
}

export function MyTasksView() {
  return (
    <div className="h-full">
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

      <div className="p-6">
        {/* Greeting */}
        <h2 className="text-2xl font-bold mb-6">Good evening, Shashank</h2>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Recents card */}
          <div className="col-span-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Recents</h3>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                  <div className="h-3 flex-1 rounded bg-muted animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Agenda card */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Agenda</h3>
            <div className="flex flex-col items-center py-6 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground mb-4">
                Connect your calendar to view upcoming events
              </p>
              <div className="space-y-2 w-full">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <span className="h-4 w-4 rounded bg-blue-500" />
                  Google Calendar
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <span className="h-4 w-4 rounded bg-blue-700" />
                  Microsoft Outlook
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* My Work section */}
        <div>
          <h3 className="text-sm font-semibold mb-3">My Work</h3>

          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-border mb-4">
            {['To Do', 'Done', 'Delegated'].map((tab, i) => (
              <button
                key={tab}
                className={cn(
                  'pb-2 text-sm font-medium transition-colors border-b-2',
                  i === 0
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Task groups */}
          <div className="space-y-1">
            {taskGroups.map((group) => (
              <TaskGroup key={group.title} group={group} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskGroup({ group }: { group: typeof taskGroups[0] }) {
  const expanded = group.tasks.length > 0

  return (
    <div>
      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>{group.title}</span>
        <span className="text-muted-foreground">{group.count}</span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-0.5">
          {group.tasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer"
            >
              {statusIcon[task.status]}
              <span className="flex-1 text-sm truncate">{task.title}</span>
              <span className="text-2xs text-muted-foreground truncate max-w-[200px]">
                {task.space} &middot; {task.list}
              </span>
              <span className="text-2xs text-muted-foreground">{task.dueDate}</span>
              <Flag className={cn('h-3 w-3', priorityColor[task.priority])} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
