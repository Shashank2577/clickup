'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Bell, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerList, StaggerItem, InteractiveRow } from '@/components/motion'

interface ReplyThread {
  id: string
  taskName: string
  taskStatus: 'todo' | 'in-progress' | 'in-review' | 'done'
  lastReply: {
    author: string
    authorInitials: string
    content: string
    timeAgo: string
  }
  replyCount: number
  unread: boolean
  spaceName: string
}

const demoThreads: ReplyThread[] = [
  {
    id: '1',
    taskName: 'Mobile App MVP Development',
    taskStatus: 'in-progress',
    lastReply: {
      author: 'Alex Chen',
      authorInitials: 'AC',
      content: 'Updated the API endpoints. Can you review the changes to the auth module?',
      timeAgo: '2 hours ago',
    },
    replyCount: 8,
    unread: true,
    spaceName: 'Engineering',
  },
  {
    id: '2',
    taskName: 'Design System v2',
    taskStatus: 'in-review',
    lastReply: {
      author: 'Emma Thompson',
      authorInitials: 'ET',
      content: 'The new color tokens look great. Just a small suggestion on the spacing scale.',
      timeAgo: '4 hours ago',
    },
    replyCount: 12,
    unread: true,
    spaceName: 'Design',
  },
  {
    id: '3',
    taskName: 'Sprint Planning Q3',
    taskStatus: 'done',
    lastReply: {
      author: 'Michael Brown',
      authorInitials: 'MB',
      content: 'All stories have been estimated. Ready to kick off the sprint on Monday.',
      timeAgo: 'Yesterday',
    },
    replyCount: 5,
    unread: false,
    spaceName: 'Product',
  },
  {
    id: '4',
    taskName: 'API Integration',
    taskStatus: 'in-progress',
    lastReply: {
      author: 'James Wilson',
      authorInitials: 'JW',
      content: 'Found a rate limiting issue with the third-party API. Working on a retry mechanism.',
      timeAgo: '2 days ago',
    },
    replyCount: 3,
    unread: false,
    spaceName: 'Engineering',
  },
  {
    id: '5',
    taskName: 'Product Launch Campaign',
    taskStatus: 'todo',
    lastReply: {
      author: 'Rachel Green',
      authorInitials: 'RG',
      content: 'Draft copy for the landing page is ready for review.',
      timeAgo: '3 days ago',
    },
    replyCount: 6,
    unread: false,
    spaceName: 'Marketing',
  },
]

const statusBadgeVariant = {
  todo: 'todo' as const,
  'in-progress': 'in-progress' as const,
  'in-review': 'in-review' as const,
  done: 'done' as const,
}

export function RepliesView() {
  const unreadCount = demoThreads.filter((t) => t.unread).length

  return (
    <div className="h-full">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Replies</h1>
            {unreadCount > 0 && (
              <Badge variant="default">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs">
              Mark all read
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Content */}
      <div className="overflow-y-auto">
        {demoThreads.length === 0 ? (
          <FadeIn className="flex flex-col items-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">No replies yet</h3>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              When someone replies to your comments, they will appear here.
            </p>
          </FadeIn>
        ) : (
          <StaggerList>
            {demoThreads.map((thread) => (
              <StaggerItem key={thread.id}>
                <InteractiveRow className="flex items-start gap-3 border-b border-border/50 px-6 py-3 cursor-pointer">
                  <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {thread.lastReply.authorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {thread.taskName}
                      </span>
                      <Badge variant={statusBadgeVariant[thread.taskStatus]}>
                        {thread.taskStatus.replace('-', ' ')}
                      </Badge>
                      {thread.unread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 truncate">
                      <span className="font-medium text-foreground">
                        {thread.lastReply.author}
                      </span>
                      {': '}
                      {thread.lastReply.content}
                    </p>
                    <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                      <span>{thread.spaceName}</span>
                      <span>{thread.replyCount} replies</span>
                      <span>{thread.lastReply.timeAgo}</span>
                    </div>
                  </div>
                </InteractiveRow>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  )
}
