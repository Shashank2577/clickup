'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Plus,
  Star,
  Lock,
  Users,
  Search,
  MoreHorizontal,
  BarChart3,
  Brain,
  Clock,
  FolderKanban,
  Sparkles,
  Boxes,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Sidebar items
interface DashboardSidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
}

const sidebarItems: DashboardSidebarItem[] = [
  { id: 'all', label: 'All Dashboards', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'my', label: 'My Dashboards', icon: <BarChart3 className="h-4 w-4" />, count: 1 },
  { id: 'shared', label: 'Shared with me', icon: <Users className="h-4 w-4" /> },
  { id: 'private', label: 'Private', icon: <Lock className="h-4 w-4" /> },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
]

// Template cards
interface DashboardTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  featured?: boolean
}

const dashboardTemplates: DashboardTemplate[] = [
  {
    id: 'simple',
    title: 'Simple Dashboard',
    description: 'Track tasks, statuses, and team workload at a glance with essential widgets.',
    icon: <BarChart3 className="h-6 w-6" />,
    color: 'bg-blue-500/10 text-blue-500',
    featured: true,
  },
  {
    id: 'ai-team',
    title: 'AI Team Center',
    description: 'AI-powered insights into team productivity, blockers, and resource allocation.',
    icon: <Brain className="h-6 w-6" />,
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    id: 'time-tracking',
    title: 'Time Tracking',
    description: 'Monitor time spent across projects, teams, and individual contributors.',
    icon: <Clock className="h-6 w-6" />,
    color: 'bg-green-500/10 text-green-500',
  },
  {
    id: 'project-mgmt',
    title: 'Project Management',
    description: 'Complete project overview with milestones, burndown charts, and team velocity.',
    icon: <FolderKanban className="h-6 w-6" />,
    color: 'bg-orange-500/10 text-orange-500',
  },
  {
    id: 'ai-personal',
    title: 'AI Personal Center',
    description: 'Your personal AI assistant tracking your tasks, habits, and productivity patterns.',
    icon: <Sparkles className="h-6 w-6" />,
    color: 'bg-pink-500/10 text-pink-500',
  },
  {
    id: 'scratch',
    title: 'Start from scratch',
    description: 'Build a custom dashboard with any combination of widgets and data sources.',
    icon: <Boxes className="h-6 w-6" />,
    color: 'bg-muted text-muted-foreground',
  },
]

// Existing dashboards
interface ExistingDashboard {
  id: string
  title: string
  widgetCount: number
  lastUpdated: string
  owner: string
  favorited: boolean
}

const existingDashboards: ExistingDashboard[] = [
  {
    id: '1',
    title: 'Sprint Overview',
    widgetCount: 6,
    lastUpdated: 'Apr 25, 2026',
    owner: 'Shashank',
    favorited: true,
  },
]

function DashboardSidebar({
  activeItem,
  onItemClick,
}: {
  activeItem: string
  onItemClick: (id: string) => void
}) {
  return (
    <div className="w-56 border-r border-border bg-muted/30 p-3 shrink-0">
      <div className="space-y-0.5">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              activeItem === item.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground/70 hover:bg-accent hover:text-foreground'
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              {item.icon}
            </span>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.count !== undefined && (
              <span className="text-2xs text-muted-foreground">{item.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: DashboardTemplate }) {
  return (
    <div className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', template.color)}>
          {template.icon}
        </span>
        {template.featured && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
            Popular
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold mb-1">{template.title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">
        {template.description}
      </p>
      <div className="mt-3 flex items-center gap-1 text-2xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Use template
        <ChevronRight className="h-3 w-3" />
      </div>
    </div>
  )
}

function ExistingDashboardRow({ dashboard }: { dashboard: ExistingDashboard }) {
  return (
    <div className="group flex items-center border-b border-border/50 px-6 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <LayoutDashboard className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{dashboard.title}</span>
        {dashboard.favorited && (
          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />
        )}
      </div>
      <span className="text-xs text-muted-foreground w-24">{dashboard.widgetCount} widgets</span>
      <span className="text-xs text-muted-foreground w-32">{dashboard.lastUpdated}</span>
      <span className="text-xs text-muted-foreground w-24">{dashboard.owner}</span>
      <div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="rounded p-0.5 hover:bg-accent">
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export function DashboardsHub() {
  const [activeSidebarItem, setActiveSidebarItem] = useState('all')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Dashboards</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm">
            <Search className="h-4 w-4" />
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="h-3 w-3" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Body with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar activeItem={activeSidebarItem} onItemClick={setActiveSidebarItem} />

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Template picker */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Create a dashboard</h3>
              <button className="text-2xs text-primary hover:underline flex items-center gap-0.5">
                View all templates
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {dashboardTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>

          {/* Existing dashboards */}
          {existingDashboards.length > 0 && (
            <div>
              <div className="px-6 py-2 border-t border-border">
                <h3 className="text-sm font-semibold">Recent dashboards</h3>
              </div>
              {/* Table header */}
              <div className="flex items-center px-6 py-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="flex-1 min-w-0">Name</div>
                <div className="w-24">Widgets</div>
                <div className="w-32">Last updated</div>
                <div className="w-24">Owner</div>
                <div className="w-8" />
              </div>
              {existingDashboards.map((dashboard) => (
                <ExistingDashboardRow key={dashboard.id} dashboard={dashboard} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
