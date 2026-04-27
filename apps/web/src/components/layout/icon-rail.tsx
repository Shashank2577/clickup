'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  CalendarDays,
  Sparkles,
  Users,
  FileText,
  LayoutDashboard,
  PenTool,
  CheckSquare,
  MonitorPlay,
  Target,
  Clock,
  MoreHorizontal,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { motion, FadeIn, springs, durations } from '@/components/motion'
import { useAuthStore, useNotificationStore } from '@/stores'

const navItems = [
  { icon: Home, label: 'Home', href: '/', segment: '' },
  { icon: CalendarDays, label: 'Planner', href: '/planner', segment: 'planner' },
  { icon: Sparkles, label: 'AI', href: '/ai', segment: 'ai' },
  { icon: Users, label: 'Teams', href: '/teams', segment: 'teams' },
  { icon: FileText, label: 'Docs', href: '/docs', segment: 'docs' },
  { icon: LayoutDashboard, label: 'Dashboards', href: '/dashboards', segment: 'dashboards' },
  { icon: PenTool, label: 'Whiteboards', href: '/whiteboards', segment: 'whiteboards' },
  { icon: CheckSquare, label: 'Forms', href: '/forms', segment: 'forms' },
  { icon: MonitorPlay, label: 'Clips', href: '/clips', segment: 'clips' },
  { icon: Target, label: 'Goals', href: '/goals', segment: 'goals' },
  { icon: Clock, label: 'Timesheets', href: '/timesheets', segment: 'timesheets' },
]

// Animated icon wrapper — subtle idle animation per icon type
function AnimatedIcon({ icon: Icon, active }: { icon: typeof Home; active: boolean }) {
  return (
    <motion.div
      animate={active ? { scale: [1, 1.08, 1] } : {}}
      transition={active ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={active ? 2.2 : 1.8} />
    </motion.div>
  )
}

export function IconRail() {
  const pathname = usePathname()
  const workspace = useAuthStore((s) => s.workspace)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  function isActive(segment: string) {
    if (segment === '') return pathname === '/'
    return pathname.startsWith(`/${segment}`)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <FadeIn>
        <div className="flex h-full w-icon-rail flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
          {/* Workspace avatar */}
          <Link
            href="/"
            className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold"
          >
            {workspace?.name?.[0] ?? 'C'}
          </Link>

          {/* Nav items — spread evenly with breathing room */}
          <nav className="flex flex-1 flex-col items-center justify-start gap-1 overflow-y-auto scrollbar-hide py-1">
            {navItems.map((item) => {
              const active = isActive(item.segment)
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href} className="relative">
                      <motion.div
                        className={cn(
                          'group relative flex h-9 w-9 flex-col items-center justify-center rounded-md transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        whileHover={{
                          scale: 1.08,
                          transition: { duration: durations.fast },
                        }}
                        whileTap={{
                          scale: 0.92,
                          transition: { duration: durations.instant },
                        }}
                      >
                        <AnimatedIcon icon={item.icon} active={active} />
                        {item.segment === '' && unreadCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                        <span className="mt-[3px] text-[8px] font-medium leading-none max-w-[2.25rem] truncate">
                          {item.label}
                        </span>
                      </motion.div>
                      {active && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute -left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                          transition={springs.snappy}
                        />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* Bottom items */}
          <div className="flex flex-col items-center gap-1 border-t border-sidebar-border pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  className="flex h-9 w-9 flex-col items-center justify-center rounded-md text-[8px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  whileHover={{ scale: 1.08, transition: { duration: durations.fast } }}
                  whileTap={{ scale: 0.92, transition: { duration: durations.instant } }}
                >
                  <MoreHorizontal className="h-[14px] w-[14px]" strokeWidth={1.8} />
                  <span className="mt-[3px]">More</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right">More</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  className="flex h-9 w-9 flex-col items-center justify-center rounded-md text-[8px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  whileHover={{ scale: 1.08, transition: { duration: durations.fast } }}
                  whileTap={{ scale: 0.92, transition: { duration: durations.instant } }}
                >
                  <UserPlus className="h-[14px] w-[14px]" strokeWidth={1.8} />
                  <span className="mt-[3px]">Invite</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right">Invite</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </FadeIn>
    </TooltipProvider>
  )
}
