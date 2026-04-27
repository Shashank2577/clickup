'use client'

import {
  Search,
  PenLine,
  Settings,
  MonitorPlay,
  FileText,
  Bell,
  BarChart3,
  ChevronDown,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { motion, StatusDot, springs, durations } from '@/components/motion'
import { useAuthStore, useNotificationStore } from '@/stores'

export function TopBar({ onSearchClick }: { onSearchClick?: () => void }) {
  const workspace = useAuthStore((s) => s.workspace)
  const user = useAuthStore((s) => s.user)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <TooltipProvider delayDuration={0}>
      <header className="flex h-topbar items-center border-b border-border bg-background px-3 gap-2">
        <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent transition-colors">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            {workspace?.name?.[0] ?? 'C'}
          </div>
          <span className="max-w-[180px] truncate">{workspace?.name ?? 'Workspace'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <motion.div whileHover={{ scale: 1.02, transition: { duration: durations.fast } }} whileTap={{ scale: 0.97, transition: { duration: durations.instant } }}>
          <Button size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </motion.div>

        <div className="flex-1 flex justify-center">
          <motion.button
            onClick={onSearchClick}
            className="flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
            whileHover={{ borderColor: 'hsl(var(--primary) / 0.4)', boxShadow: '0 0 0 2px hsl(var(--primary) / 0.1)', transition: { duration: durations.normal } }}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium md:inline-block">⌘K</kbd>
          </motion.button>
        </div>

        <div className="flex items-center gap-0.5">
          {[
            { icon: PenLine, label: 'Quick action' },
            { icon: Settings, label: 'Automations' },
            { icon: MonitorPlay, label: 'Clips' },
            { icon: FileText, label: 'Notepad' },
            { icon: Bell, label: 'Notifications' },
            { icon: BarChart3, label: 'Reports' },
          ].map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.1, rotate: 5, transition: springs.snappy }} whileTap={{ scale: 0.9, transition: { duration: durations.instant } }}>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground relative">
                    <Icon className="h-4 w-4" />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <button className="relative ml-1">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px]">{user?.initials ?? 'SS'}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status="online" size="sm" />
            </span>
          </button>
        </div>
      </header>
    </TooltipProvider>
  )
}
