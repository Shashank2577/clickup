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
  Gem,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { motion, FadeIn, springs, durations } from '@/components/motion'

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

export function IconRail() {
  const pathname = usePathname()

  function isActive(segment: string) {
    if (segment === '') return pathname === '/'
    return pathname.startsWith(`/${segment}`)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <FadeIn>
        <div className="flex h-full w-icon-rail flex-col items-center border-r border-sidebar-border bg-sidebar py-2">
          {/* Workspace avatar */}
          <Link
            href="/"
            className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold"
          >
            C
          </Link>

          {/* Nav items */}
          <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto scrollbar-hide py-2">
            {navItems.map((item) => {
              const active = isActive(item.segment)
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href} className="relative">
                      <motion.div
                        className={cn(
                          'group relative flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        whileHover={{ scale: 1.05, transition: { duration: durations.fast } }}
                        whileTap={{ scale: 0.95, transition: { duration: durations.instant } }}
                      >
                        <item.icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 2} />
                        <span className="mt-0.5 max-w-[2.5rem] truncate leading-none">
                          {item.label}
                        </span>
                      </motion.div>
                      {/* Active indicator bar that slides between items */}
                      {active && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
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
          <div className="flex flex-col items-center gap-0.5 border-t border-sidebar-border pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  whileHover={{ scale: 1.05, transition: { duration: durations.fast } }}
                  whileTap={{ scale: 0.95, transition: { duration: durations.instant } }}
                >
                  <MoreHorizontal className="h-4.5 w-4.5" />
                  <span className="mt-0.5">More</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right">More</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  whileHover={{ scale: 1.05, transition: { duration: durations.fast } }}
                  whileTap={{ scale: 0.95, transition: { duration: durations.instant } }}
                >
                  <UserPlus className="h-4.5 w-4.5" />
                  <span className="mt-0.5">Invite</span>
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
