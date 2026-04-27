'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Settings, Flag, Calendar, GitBranch, CheckCircle2, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/motion'
import { useAuthStore, useTaskStore } from '@/stores'

const statusIcon = { 'todo': <Circle className="h-3.5 w-3.5 text-status-todo" />, 'in-progress': <Clock className="h-3.5 w-3.5 text-status-in-progress" />, 'in-review': <GitBranch className="h-3.5 w-3.5 text-status-in-review" />, 'done': <CheckCircle2 className="h-3.5 w-3.5 text-status-done" /> }
const priorityColor = { urgent: 'text-priority-urgent', high: 'text-priority-high', normal: 'text-priority-normal', low: 'text-priority-low', none: 'text-muted-foreground' }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function MyTasksView() {
  const user = useAuthStore((s) => s.user)
  const { tasks, isLoading, loadMyTasks } = useTaskStore()

  useEffect(() => { loadMyTasks('dueDate') }, [loadMyTasks])

  return <div className="h-full"><div className="flex items-center justify-between border-b border-border px-6 py-3"><h1 className="text-lg font-semibold">My Tasks</h1><div className="flex items-center gap-2"><Button variant="outline" size="sm">Manage cards</Button><Button variant="ghost" size="icon-sm"><Settings className="h-4 w-4" /></Button></div></div>
    <div className="p-6"><h2 className="text-2xl font-bold mb-6">{greeting()}, {user?.fullName?.split(' ')[0] ?? 'there'}</h2>
      <div className="rounded-lg border border-border p-4 mb-8"><h3 className="text-sm font-semibold mb-3">My Work</h3>
        {isLoading ? <div className='space-y-2'><Skeleton className='h-8 w-full' /><Skeleton className='h-8 w-full' /></div> : <div className="space-y-0.5">{tasks.map((task) => <div key={task.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer">{statusIcon[task.status] ?? <Circle className='h-3.5 w-3.5' />}<span className="flex-1 text-sm truncate">{task.title}</span><span className="text-2xs text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span><Flag className={cn('h-3 w-3', priorityColor[task.priority])} /><Calendar className="h-3.5 w-3.5 text-muted-foreground/30" /></div>)}</div>}
      </div>
    </div>
  </div>
}
