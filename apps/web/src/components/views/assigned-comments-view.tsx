'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Check, Circle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerList, StaggerItem, InteractiveRow } from '@/components/motion'

interface AssignedComment {
  id: string
  content: string
  taskName: string
  taskStatus: 'todo' | 'in-progress' | 'in-review' | 'done'
  assigner: {
    name: string
    initials: string
  }
  assignedAt: string
  resolved: boolean
  spaceName: string
}

const demoComments: AssignedComment[] = [
  {
    id: '1',
    content: 'Can you add error handling for the edge case when the API returns a 429? We need a retry with exponential backoff.',
    taskName: 'API Integration',
    taskStatus: 'in-progress',
    assigner: { name: 'Alex Chen', initials: 'AC' },
    assignedAt: '2 hours ago',
    resolved: false,
    spaceName: 'Engineering',
  },
  {
    id: '2',
    content: 'Please update the button hover states to match the new design tokens. The transition should be 200ms ease.',
    taskName: 'Design System v2',
    taskStatus: 'in-review',
    assigner: { name: 'Emma Thompson', initials: 'ET' },
    assignedAt: '5 hours ago',
    resolved: false,
    spaceName: 'Design',
  },
  {
    id: '3',
    content: 'Add unit tests for the payment processing module. Cover the refund flow and partial payment scenarios.',
    taskName: 'Mobile App MVP Development',
    taskStatus: 'in-progress',
    assigner: { name: 'James Wilson', initials: 'JW' },
    assignedAt: 'Yesterday',
    resolved: false,
    spaceName: 'Engineering',
  },
  {
    id: '4',
    content: 'Review the copy on the pricing page. I think we should emphasize the free tier more prominently.',
    taskName: 'Product Launch Campaign',
    taskStatus: 'todo',
    assigner: { name: 'Michael Brown', initials: 'MB' },
    assignedAt: '2 days ago',
    resolved: true,
    spaceName: 'Marketing',
  },
  {
    id: '5',
    content: 'The onboarding flow needs a skip option for experienced users. Can you wire that up?',
    taskName: 'Beta Testing Program',
    taskStatus: 'todo',
    assigner: { name: 'Kate Johnson', initials: 'KJ' },
    assignedAt: '3 days ago',
    resolved: true,
    spaceName: 'Product',
  },
]

const statusBadgeVariant = {
  todo: 'todo' as const,
  'in-progress': 'in-progress' as const,
  'in-review': 'in-review' as const,
  done: 'done' as const,
}

export function AssignedCommentsView() {
  const [comments, setComments] = useState(demoComments)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved
    if (filter === 'resolved') return c.resolved
    return true
  })

  const openCount = comments.filter((c) => !c.resolved).length
  const resolvedCount = comments.filter((c) => c.resolved).length

  function handleResolve(commentId: string) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, resolved: !c.resolved } : c
      )
    )
  }

  return (
    <div className="h-full">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Assigned Comments</h1>
            {openCount > 0 && (
              <Badge variant="default">{openCount} open</Badge>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Filter tabs */}
      <div className="flex items-center gap-4 border-b border-border px-6">
        {([
          { key: 'all' as const, label: 'All', count: comments.length },
          { key: 'open' as const, label: 'Open', count: openCount },
          { key: 'resolved' as const, label: 'Resolved', count: resolvedCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2',
              filter === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            <span className="text-xs text-muted-foreground">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto">
        {filteredComments.length === 0 ? (
          <FadeIn className="flex flex-col items-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">No assigned comments</h3>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {filter === 'resolved'
                ? 'No resolved comments yet.'
                : filter === 'open'
                  ? 'All caught up! No open comments assigned to you.'
                  : 'When someone assigns a comment to you, it will appear here.'}
            </p>
          </FadeIn>
        ) : (
          <StaggerList>
            {filteredComments.map((comment) => (
              <StaggerItem key={comment.id}>
                <InteractiveRow className="flex items-start gap-3 border-b border-border/50 px-6 py-3 cursor-pointer">
                  <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {comment.assigner.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{comment.assigner.name}</span>
                      <span className="text-2xs text-muted-foreground">assigned to you</span>
                      <span className="text-2xs text-muted-foreground">{comment.assignedAt}</span>
                    </div>
                    <p className={cn(
                      'text-sm mb-2',
                      comment.resolved && 'text-muted-foreground line-through'
                    )}>
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant[comment.taskStatus]}>
                        {comment.taskStatus.replace('-', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {comment.spaceName} &middot; {comment.taskName}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={comment.resolved ? 'ghost' : 'outline'}
                    size="sm"
                    className={cn(
                      'shrink-0 gap-1 text-xs',
                      comment.resolved && 'text-status-done'
                    )}
                    onClick={() => handleResolve(comment.id)}
                  >
                    {comment.resolved ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5" />
                        Resolve
                      </>
                    )}
                  </Button>
                </InteractiveRow>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  )
}
