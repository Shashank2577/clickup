'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Settings,
  CheckCircle2,
  MessageSquare,
  AtSign,
  GitBranch,
  FileText,
  Users,
  Clock,
  Inbox,
  Filter,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  StaggerList,
  StaggerItem,
  InteractiveRow,
  TabContent,
  FadeIn,
  springs,
  Skeleton,
} from '@/components/motion'
import { useNotificationStore } from '@/stores'

type TabId = 'primary' | 'other' | 'later' | 'cleared'

// === WIRING: notification type icons ===
const typeIcons: Record<string, React.ReactNode> = {
  'task-assigned': <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  'comment': <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  'mention': <AtSign className="h-3.5 w-3.5 text-orange-500" />,
  'status-change': <GitBranch className="h-3.5 w-3.5 text-green-500" />,
  'subtask': <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
  'due-date': <Clock className="h-3.5 w-3.5 text-red-500" />,
}

export function InboxView() {
  // === WIRING: notification store for all inbox operations ===
  const {
    activeTab,
    notifications,
    isLoading,
    setActiveTab,
    loadNotifications,
    markAsRead,
    snooze,
    clear,
    markAllAsRead,
    clearAll,
  } = useNotificationStore()

  // === WIRING: load notifications on mount and tab change ===
  useEffect(() => {
    loadNotifications(activeTab)
  }, [activeTab, loadNotifications])

  // === WIRING: tab counts from notifications.length ===
  const tabs: { id: TabId; label: string; count?: number }[] = [
    {
      id: 'primary',
      label: 'Primary',
      count: activeTab === 'primary' ? notifications.length : undefined,
    },
    { id: 'other', label: 'Other' },
    { id: 'later', label: 'Later' },
    { id: 'cleared', label: 'Cleared' },
  ]

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
          {/* === WIRING: "Clear all" calls clearAll on the store === */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={clearAll}
          >
            Clear all
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}

            {/* Unread count badge */}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-2xs font-semibold',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.count}
              </span>
            )}

            {/* Active tab indicator with layoutId animation */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeInboxTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={springs.snappy}
              />
            )}
          </button>
        ))}

        {/* === WIRING: "Mark all as read" calls markAllAsRead === */}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Notification list */}
      <TabContent
        activeKey={activeTab}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {/* === WIRING: Skeleton rows for loading state === */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : notifications.length > 0 ? (
          <StaggerList>
            {/* Section header */}
            <StaggerItem>
              <div className="px-4 py-2 bg-muted/30">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notifications
                </span>
              </div>
            </StaggerItem>

            {/* Notification rows */}
            {notifications.map((notification) => (
              <StaggerItem key={notification.id}>
                <InteractiveRow
                  className={cn(
                    'group flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer',
                    !notification.isRead && 'bg-primary/[0.03]'
                  )}
                >
                  {/* Unread dot */}
                  <div className="flex items-center pt-1.5">
                    {!notification.isRead ? (
                      <motion.div
                        className="h-2 w-2 rounded-full bg-primary"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  {/* Type icon */}
                  <div className="flex items-center justify-center pt-0.5">
                    {typeIcons[notification.type] ?? (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Author avatar */}
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className="text-[10px] text-white"
                      style={{ backgroundColor: notification.authorColor }}
                    >
                      {notification.authorInitials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Notification content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm truncate',
                        !notification.isRead
                          ? 'font-medium text-foreground'
                          : 'text-foreground/80'
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {notification.description}
                    </p>
                  </div>

                  {/* Timestamp and hover actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-2xs text-muted-foreground whitespace-nowrap">
                      {new Date(notification.createdAt).toLocaleTimeString()}
                    </span>

                    {/* === WIRING: hover actions — mark as read, snooze, clear === */}
                    <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                      <button
                        className="rounded p-1 hover:bg-accent"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="rounded p-1 hover:bg-accent"
                        onClick={() =>
                          snooze(
                            notification.id,
                            new Date(Date.now() + 3600_000).toISOString()
                          )
                        }
                      >
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="rounded p-1 hover:bg-accent"
                        onClick={() => clear(notification.id)}
                      >
                        <Archive className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </InteractiveRow>
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          /* Empty state */
          <FadeIn delay={0.1}>
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                <Users className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Looking to collaborate?
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Notifications from your tasks, comments, and mentions will show
                up here.
              </p>
            </div>
          </FadeIn>
        )}
      </TabContent>
    </div>
  )
}
