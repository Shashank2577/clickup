'use client'

import { AppShell } from '@/components/layout/app-shell'
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
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { FadeIn, InteractiveRow, motion, AnimatePresence, springs } from '@/components/motion'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done'
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  assignee?: string
}

interface SpaceGroup {
  spaceName: string
  listName: string
  color: string
  tasks: Task[]
}

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; variant: 'todo' | 'in-progress' | 'in-review' | 'done' }> = {
  'todo': { icon: <Circle className="h-3.5 w-3.5" />, label: 'TO DO', variant: 'todo' },
  'in-progress': { icon: <Clock className="h-3.5 w-3.5" />, label: 'IN PROGRESS', variant: 'in-progress' },
  'in-review': { icon: <GitBranch className="h-3.5 w-3.5" />, label: 'IN REVIEW', variant: 'in-review' },
  'done': { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'DONE', variant: 'done' },
}

const priorityConfig: Record<TaskPriority, { color: string }> = {
  urgent: { color: 'text-priority-urgent' },
  high: { color: 'text-priority-high' },
  normal: { color: 'text-priority-normal' },
  low: { color: 'text-priority-low' },
  none: { color: 'text-muted-foreground/30' },
}

const demoSpaceGroups: SpaceGroup[] = [
  {
    spaceName: 'Engineering',
    listName: 'General Project Manager',
    color: 'bg-blue-500',
    tasks: [
      { id: '1', title: 'Market Research & Analysis', status: 'done', priority: 'normal', dueDate: '5/11/26' },
      { id: '2', title: 'Mobile App MVP Development', status: 'in-progress', priority: 'urgent', dueDate: '6/16/26' },
      { id: '3', title: 'API Integration', status: 'in-progress', priority: 'normal', dueDate: '6/16/26' },
      { id: '4', title: 'Database Schema Design', status: 'done', priority: 'high' },
    ],
  },
  {
    spaceName: 'Design',
    listName: 'UI/UX Tasks',
    color: 'bg-purple-500',
    tasks: [
      { id: '5', title: 'Design System v2', status: 'in-review', priority: 'high', dueDate: '5/20/26' },
      { id: '6', title: 'Mobile onboarding flow', status: 'todo', priority: 'normal', dueDate: '6/1/26' },
      { id: '7', title: 'Icon set update', status: 'todo', priority: 'low' },
    ],
  },
  {
    spaceName: 'Marketing',
    listName: 'Launch Campaign',
    color: 'bg-orange-500',
    tasks: [
      { id: '8', title: 'Product Launch Campaign', status: 'todo', priority: 'normal', dueDate: '7/21/26' },
      { id: '9', title: 'Social Media Assets', status: 'todo', priority: 'low', dueDate: '7/15/26' },
      { id: '10', title: 'Press Release Draft', status: 'todo', priority: 'high', dueDate: '7/10/26' },
    ],
  },
  {
    spaceName: 'Product',
    listName: 'Roadmap Items',
    color: 'bg-green-500',
    tasks: [
      { id: '11', title: 'Beta Testing Program', status: 'todo', priority: 'high', dueDate: '7/2/26' },
      { id: '12', title: 'User Survey Distribution', status: 'done', priority: 'normal' },
      { id: '13', title: 'Competitor Benchmarking', status: 'done', priority: 'normal' },
    ],
  },
]

function SpaceGroupSection({ group }: { group: SpaceGroup }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={springs.snappy}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.div>
        <span className={cn('h-2.5 w-2.5 rounded-full', group.color)} />
        <span>{group.spaceName}</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-muted-foreground">{group.listName}</span>
        <span className="text-muted-foreground text-xs">({group.tasks.length})</span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
            style={{ overflow: 'hidden' }}
          >
            {/* Column headers */}
            <div className="flex items-center border-b border-border/50 px-4 py-1.5 text-2xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="flex-1 min-w-0 pl-6">Name</div>
              <div className="w-24 text-center">Due date</div>
              <div className="w-20 text-center">Priority</div>
              <div className="w-28 text-center">Status</div>
              <div className="w-20 text-center">Assignee</div>
            </div>

            {group.tasks.map((task) => {
              const status = statusConfig[task.status]
              const priority = priorityConfig[task.priority]
              return (
                <InteractiveRow
                  key={task.id}
                  className="group flex items-center border-b border-border/30 px-4 py-1.5 cursor-pointer"
                >
                  <div className="flex flex-1 items-center gap-2 min-w-0 pl-6">
                    <span className="flex items-center justify-center">{status.icon}</span>
                    <span className="flex-1 truncate text-sm">{task.title}</span>
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
                    <Flag className={cn('h-3.5 w-3.5', priority.color)} />
                  </div>
                  <div className="w-28 flex justify-center">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="w-20 flex justify-center">
                    <User className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                </InteractiveRow>
              )
            })}

            <button className="flex items-center gap-2 px-4 py-2 pl-10 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AllTasksPage() {
  return (
    <AppShell>
      <div className="h-full flex flex-col">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">All Tasks</h1>
              <Badge variant="secondary">
                {demoSpaceGroups.reduce((sum, g) => sum + g.tasks.length, 0)}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Filter className="h-3 w-3" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <ArrowUpDown className="h-3 w-3" />
                Sort
              </Button>
              <Button variant="ghost" size="sm" className="text-xs">
                Group: Space
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="gap-1">
                <Plus className="h-3 w-3" />
                Add Task
              </Button>
            </div>
          </div>
        </FadeIn>

        {/* Task list grouped by space */}
        <div className="flex-1 overflow-y-auto">
          {demoSpaceGroups.map((group) => (
            <SpaceGroupSection key={group.spaceName} group={group} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
