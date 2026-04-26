'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Bell,
  Settings,
  X,
  CheckCircle2,
  MessageSquare,
  AtSign,
  GitBranch,
  FileText,
  Users,
  Clock,
  ChevronDown,
  MoreHorizontal,
  Inbox,
  Filter,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type NotificationType = 'task-assigned' | 'comment' | 'mention' | 'status-change' | 'subtask' | 'due-date'
type TabId = 'primary' | 'other' | 'later' | 'cleared'

interface Notification {
  id: string
  type: NotificationType
  title: string
  description: string
  timeAgo: string
  read: boolean
  avatarInitial: string
  avatarColor: string
  space?: string
}

// Tab config
const tabs: { id: TabId; label: string; count?: number }[] = [
  { id: 'primary', label: 'Primary', count: 5 },
  { id: 'other', label: 'Other', count: 2 },
  { id: 'later', label: 'Later' },
  { id: 'cleared', label: 'Cleared' },
]

// Notification type icons
const typeIcons: Record<NotificationType, React.ReactNode> = {
  'task-assigned': <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  'comment': <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  'mention': <AtSign className="h-3.5 w-3.5 text-orange-500" />,
  'status-change': <GitBranch className="h-3.5 w-3.5 text-green-500" />,
  'subtask': <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
  'due-date': <Clock className="h-3.5 w-3.5 text-red-500" />,
}

// Demo data
const primaryNotifications: Notification[] = [
  {
    id: '1',
    type: 'task-assigned',
    title: 'You were assigned to "Mobile App MVP Development"',
    description: 'in General Project Manager',
    timeAgo: '2m ago',
    read: false,
    avatarInitial: 'S',
    avatarColor: 'bg-blue-500',
    space: 'Space',
  },
  {
    id: '2',
    type: 'comment',
    title: 'Alex commented on "API Integration"',
    description: '"Let\'s sync on the auth endpoints before the sprint review tomorrow."',
    timeAgo: '15m ago',
    read: false,
    avatarInitial: 'A',
    avatarColor: 'bg-green-500',
    space: 'Space',
  },
  {
    id: '3',
    type: 'mention',
    title: 'Jordan mentioned you in "Beta Testing Program"',
    description: '"@Shashank can you review the test matrix before EOD?"',
    timeAgo: '1h ago',
    read: false,
    avatarInitial: 'J',
    avatarColor: 'bg-purple-500',
    space: 'Space',
  },
  {
    id: '4',
    type: 'status-change',
    title: '"Market Research & Analysis" was moved to Done',
    description: 'Status changed from In Progress to Done',
    timeAgo: '3h ago',
    read: true,
    avatarInitial: 'S',
    avatarColor: 'bg-blue-500',
    space: 'Space',
  },
  {
    id: '5',
    type: 'due-date',
    title: '"Product Launch Campaign" is due tomorrow',
    description: 'in General Project Manager',
    timeAgo: '5h ago',
    read: true,
    avatarInitial: 'C',
    avatarColor: 'bg-primary',
    space: 'Space',
  },
]

const otherNotifications: Notification[] = [
  {
    id: '6',
    type: 'subtask',
    title: 'New subtask added to "Mobile App MVP Development"',
    description: '"Performance Testing" was added by Alex',
    timeAgo: '1d ago',
    read: true,
    avatarInitial: 'A',
    avatarColor: 'bg-green-500',
    space: 'Space',
  },
  {
    id: '7',
    type: 'comment',
    title: 'Team standup notes updated',
    description: 'Daily sync notes for April 25',
    timeAgo: '1d ago',
    read: true,
    avatarInitial: 'T',
    avatarColor: 'bg-yellow-500',
    space: 'Team Space',
  },
]

const notificationsByTab: Record<TabId, Notification[]> = {
  primary: primaryNotifications,
  other: otherNotifications,
  later: [],
  cleared: [],
}

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50',
        !notification.read && 'bg-primary/[0.03]'
      )}
    >
      {/* Unread indicator */}
      <div className="flex items-center pt-1.5">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            !notification.read ? 'bg-primary' : 'bg-transparent'
          )}
        />
      </div>

      {/* Type icon */}
      <div className="flex items-center justify-center pt-0.5">
        {typeIcons[notification.type]}
      </div>

      {/* Avatar */}
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className={cn('text-[10px] text-white', notification.avatarColor)}>
          {notification.avatarInitial}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm truncate',
          !notification.read ? 'font-medium text-foreground' : 'text-foreground/80'
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {notification.description}
        </p>
        {notification.space && (
          <span className="text-2xs text-muted-foreground mt-1 inline-block">
            {notification.space}
          </span>
        )}
      </div>

      {/* Time + actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-2xs text-muted-foreground whitespace-nowrap">
          {notification.timeAgo}
        </span>
        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
          <button className="rounded p-1 hover:bg-accent" title="Mark as read">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
          </button>
          <button className="rounded p-1 hover:bg-accent" title="Snooze">
            <Clock className="h-3 w-3 text-muted-foreground" />
          </button>
          <button className="rounded p-1 hover:bg-accent" title="Archive">
            <Archive className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
        <Users className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Looking to collaborate?</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Notifications from your tasks, comments, and mentions will show up here.
        Assign tasks to teammates or leave a comment to get started.
      </p>
      <div className="flex items-center gap-3">
        <Button size="sm">
          Create a task
        </Button>
        <Button variant="outline" size="sm">
          Invite teammates
        </Button>
      </div>
    </div>
  )
}

export function InboxView() {
  const [activeTab, setActiveTab] = useState<TabId>('primary')
  const notifications = notificationsByTab[activeTab]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Inbox</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Filter className="h-3 w-3" />
            Filter
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            Clear all
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn(
                'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-2xs font-semibold',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {notifications.length > 0 ? (
          <div>
            {/* Today header */}
            {activeTab === 'primary' && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Today
                </span>
                <button className="text-2xs text-muted-foreground hover:text-foreground transition-colors">
                  Mark all as read
                </button>
              </div>
            )}
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
