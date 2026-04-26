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
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 2} />
                    <span className="mt-0.5 max-w-[2.5rem] truncate leading-none">
                      {item.label}
                    </span>
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
              <button className="flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4.5 w-4.5" />
                <span className="mt-0.5">More</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">More</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <UserPlus className="h-4.5 w-4.5" />
                <span className="mt-0.5">Invite</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Invite</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
