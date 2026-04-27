'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Target,
  Plus,
  MoreHorizontal,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  Percent,
  Hash,
  ToggleLeft,
  TrendingUp,
  ArrowLeft,
  GitBranch,
  MessageSquare,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  FadeIn,
  StaggerList,
  StaggerItem,
  InteractiveRow,
  springs,
} from '@/components/motion'

// Types
interface GoalTarget {
  id: string
  name: string
  type: 'number' | 'currency' | 'percentage' | 'boolean'
  current: number
  target: number
  unit?: string
}

interface LinkedTask {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  assignee: string
  assigneeInitial: string
  assigneeColor: string
}

interface ActivityItem {
  id: string
  author: string
  authorInitial: string
  authorColor: string
  action: string
  timestamp: string
}

// Demo data
const demoGoal = {
  id: 'g1',
  name: 'Launch MVP by End of Q2',
  description: 'Complete all core features, pass QA, and deploy the minimum viable product to production before June 30.',
  owner: 'Shashank',
  ownerInitial: 'S',
  ownerColor: 'bg-primary',
  progress: 58,
  dueDate: 'Jun 30, 2026',
  createdAt: 'Apr 1, 2026',
}

const demoTargets: GoalTarget[] = [
  {
    id: 'kt1',
    name: 'Core Features Completed',
    type: 'number',
    current: 14,
    target: 20,
    unit: 'features',
  },
  {
    id: 'kt2',
    name: 'Test Coverage',
    type: 'percentage',
    current: 72,
    target: 85,
  },
  {
    id: 'kt3',
    name: 'Development Budget Spent',
    type: 'currency',
    current: 45000,
    target: 80000,
    unit: 'USD',
  },
]

const demoLinkedTasks: LinkedTask[] = [
  { id: 'lt1', title: 'Implement user authentication flow', status: 'in-progress', assignee: 'Shashank', assigneeInitial: 'S', assigneeColor: 'bg-primary' },
  { id: 'lt2', title: 'Build dashboard widget system', status: 'in-progress', assignee: 'Taylor', assigneeInitial: 'T', assigneeColor: 'bg-orange-500' },
  { id: 'lt3', title: 'Set up CI/CD pipeline', status: 'done', assignee: 'Jordan', assigneeInitial: 'J', assigneeColor: 'bg-purple-500' },
  { id: 'lt4', title: 'API documentation v2', status: 'todo', assignee: 'Alex', assigneeInitial: 'A', assigneeColor: 'bg-green-500' },
  { id: 'lt5', title: 'WebSocket real-time layer', status: 'todo', assignee: 'Morgan', assigneeInitial: 'M', assigneeColor: 'bg-pink-500' },
]

const demoActivity: ActivityItem[] = [
  { id: 'a1', author: 'Shashank', authorInitial: 'S', authorColor: 'bg-primary', action: 'updated target "Core Features Completed" from 12 to 14', timestamp: '2 hours ago' },
  { id: 'a2', author: 'Jordan', authorInitial: 'J', authorColor: 'bg-purple-500', action: 'completed task "Set up CI/CD pipeline"', timestamp: '5 hours ago' },
  { id: 'a3', author: 'Taylor', authorInitial: 'T', authorColor: 'bg-orange-500', action: 'added task "Build dashboard widget system" to this goal', timestamp: 'Yesterday' },
  { id: 'a4', author: 'Alex', authorInitial: 'A', authorColor: 'bg-green-500', action: 'updated target "Test Coverage" from 65% to 72%', timestamp: '2 days ago' },
  { id: 'a5', author: 'Shashank', authorInitial: 'S', authorColor: 'bg-primary', action: 'created this goal', timestamp: 'Apr 1, 2026' },
]

const typeIcons: Record<string, React.ReactNode> = {
  number: <Hash className="h-3.5 w-3.5" />,
  currency: <DollarSign className="h-3.5 w-3.5" />,
  percentage: <Percent className="h-3.5 w-3.5" />,
  boolean: <ToggleLeft className="h-3.5 w-3.5" />,
}

const statusIcons: Record<string, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-status-todo" />,
  'in-progress': <Clock className="h-3.5 w-3.5 text-status-in-progress" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-status-done" />,
}

function formatValue(target: GoalTarget, value: number): string {
  if (target.type === 'currency') {
    return `$${value.toLocaleString()}`
  }
  if (target.type === 'percentage') {
    return `${value}%`
  }
  return `${value}`
}

function TargetCard({ target }: { target: GoalTarget }) {
  const pct = Math.round((target.current / target.target) * 100)
  const isComplete = pct >= 100

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {typeIcons[target.type]}
          </span>
          <div>
            <h4 className="text-sm font-medium">{target.name}</h4>
            <span className="text-2xs text-muted-foreground capitalize">{target.type}</span>
          </div>
        </div>
        <button className="rounded p-1 hover:bg-accent transition-colors">
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold">{formatValue(target, target.current)}</span>
        <span className="text-xs text-muted-foreground">/ {formatValue(target, target.target)}{target.unit ? ` ${target.unit}` : ''}</span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', isComplete ? 'bg-status-done' : 'bg-primary')}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={cn('text-2xs font-medium', isComplete ? 'text-status-done' : 'text-primary')}>{pct}%</span>
        {target.unit && <span className="text-2xs text-muted-foreground">{target.unit}</span>}
      </div>
    </div>
  )
}

export function GoalDetail({ goalId }: { goalId: string }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Goals
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Target className="h-4.5 w-4.5 text-primary" />
          <h1 className="text-sm font-semibold">{demoGoal.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
          {/* Goal overview */}
          <FadeIn>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn('text-xs', demoGoal.ownerColor)}>{demoGoal.ownerInitial}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="text-sm font-medium">{demoGoal.owner}</p>
                </div>
                <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due {demoGoal.dueDate}
                  </span>
                  <span>Created {demoGoal.createdAt}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{demoGoal.description}</p>

              {/* Main progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-lg font-bold text-primary">{demoGoal.progress}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${demoGoal.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Targets / Key Results */}
          <FadeIn delay={0.1}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Targets / Key Results</h2>
                  <Badge variant="secondary" className="text-2xs">{demoTargets.length}</Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Add Target
                </Button>
              </div>
              <StaggerList className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {demoTargets.map((target) => (
                  <StaggerItem key={target.id}>
                    <TargetCard target={target} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          </FadeIn>

          {/* Linked Tasks */}
          <FadeIn delay={0.2}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Linked Tasks</h2>
                  <Badge variant="secondary" className="text-2xs">{demoLinkedTasks.length}</Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Link Task
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {demoLinkedTasks.map((task) => (
                  <InteractiveRow
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 cursor-pointer"
                  >
                    {statusIcons[task.status]}
                    <span className="flex-1 text-sm truncate">{task.title}</span>
                    <Badge
                      variant={task.status === 'done' ? 'done' : task.status === 'in-progress' ? 'in-progress' : 'todo'}
                      className="text-2xs"
                    >
                      {task.status === 'in-progress' ? 'IN PROGRESS' : task.status.toUpperCase()}
                    </Badge>
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className={cn('text-[9px]', task.assigneeColor)}>{task.assigneeInitial}</AvatarFallback>
                    </Avatar>
                  </InteractiveRow>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Activity Feed */}
          <FadeIn delay={0.3}>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Activity</h2>
              </div>
              <div className="space-y-0">
                {demoActivity.map((item, i) => (
                  <div key={item.id} className="flex gap-3 pb-4 relative">
                    {/* Timeline line */}
                    {i < demoActivity.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                    )}
                    <Avatar className="h-7 w-7 shrink-0 z-10">
                      <AvatarFallback className={cn('text-[10px]', item.authorColor)}>{item.authorInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium">{item.author}</span>{' '}
                        <span className="text-muted-foreground">{item.action}</span>
                      </p>
                      <p className="text-2xs text-muted-foreground mt-0.5">{item.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
