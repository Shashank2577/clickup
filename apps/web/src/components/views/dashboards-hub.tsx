'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { FadeIn, InteractiveRow, InteractiveCard, Skeleton } from '@/components/motion'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores'

const sidebarItems = [
  { id: 'all', label: 'All Dashboards', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'my', label: 'My Dashboards', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'shared', label: 'Shared with me', icon: <Users className="h-4 w-4" /> },
  { id: 'private', label: 'Private', icon: <Lock className="h-4 w-4" /> },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
]

const fallbackIcons: Record<string, React.ReactNode> = {
  simple: <BarChart3 className="h-6 w-6" />,
  'ai-team': <Brain className="h-6 w-6" />,
  'time-tracking': <Clock className="h-6 w-6" />,
  'project-mgmt': <FolderKanban className="h-6 w-6" />,
  'ai-personal': <Sparkles className="h-6 w-6" />,
  scratch: <Boxes className="h-6 w-6" />,
}

// === WIRING: fallback demo data when API returns empty ===
const demoTemplates = [
  { id: 'tpl-simple', slug: 'simple', title: 'Simple Dashboard', description: 'A clean overview of your key metrics', featured: true },
  { id: 'tpl-time', slug: 'time-tracking', title: 'Time Tracking', description: 'Monitor time spent across projects', featured: false },
  { id: 'tpl-project', slug: 'project-mgmt', title: 'Project Management', description: 'Track project health and milestones', featured: true },
]

const demoDashboards = [
  { id: 'demo-1', title: 'Sprint Overview', widgetCount: 6, updatedAt: new Date().toISOString(), ownerName: 'You', favorited: true },
  { id: 'demo-2', title: 'Team Velocity', widgetCount: 4, updatedAt: new Date().toISOString(), ownerName: 'You', favorited: false },
]

export function DashboardsHub() {
  const router = useRouter()
  // === WIRING: get workspaceId from auth store ===
  const workspace = useAuthStore((s) => s.workspace)
  const [activeSidebarItem, setActiveSidebarItem] = useState('all')
  const [dashboards, setDashboards] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // === WIRING: fetch dashboards and templates from API ===
  useEffect(() => {
    async function load() {
      if (!workspace?.id) return
      setIsLoading(true)
      try {
        const [d, t] = await Promise.all([
          api.get<any[]>(`/dashboards/workspaces/${workspace.id}/dashboards`, {
            params: { tab: activeSidebarItem },
          }),
          api.get<any[]>('/dashboards/dashboard-templates'),
        ])
        setDashboards(d.length > 0 ? d : demoDashboards)
        setTemplates(t.length > 0 ? t : demoTemplates)
      } catch {
        setDashboards(demoDashboards)
        setTemplates(demoTemplates)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [workspace?.id, activeSidebarItem])

  // === WIRING: create new empty dashboard via API ===
  async function handleNewDashboard() {
    if (!workspace?.id) return
    try {
      const newDash = await api.post<{ id: string }>(
        `/dashboards/workspaces/${workspace.id}/dashboards`,
        { body: { name: 'New Dashboard' } }
      )
      router.push(`/dashboards/${newDash.id}`)
    } catch {
      // Silently fail
    }
  }

  // === WIRING: create dashboard from template via API ===
  async function handleTemplateClick(templateId: string) {
    if (!workspace?.id) return
    try {
      const newDash = await api.post<{ id: string }>(
        `/dashboards/workspaces/${workspace.id}/dashboards/from-template/${templateId}`
      )
      router.push(`/dashboards/${newDash.id}`)
    } catch {
      // Silently fail
    }
  }

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
          <Button size="sm" className="gap-1" onClick={handleNewDashboard}>
            <Plus className="h-3 w-3" />
            New Dashboard
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-border bg-muted/30 p-3 shrink-0">
          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <InteractiveRow
                key={item.id}
                onClick={() => setActiveSidebarItem(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer',
                  activeSidebarItem === item.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/70'
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <span className="flex-1 text-left truncate">{item.label}</span>
              </InteractiveRow>
            ))}
          </div>
        </div>

        {/* Main content */}
        <FadeIn className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Template cards */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Create a dashboard</h3>
              <button className="text-2xs text-primary hover:underline flex items-center gap-0.5">
                View all templates
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template) => (
                <InteractiveCard
                  key={template.id}
                  className="group flex flex-col rounded-lg border border-border bg-card p-4 cursor-pointer"
                  onClick={() => handleTemplateClick(template.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        'bg-blue-500/10 text-blue-500'
                      )}
                    >
                      {fallbackIcons[template.slug] ?? (
                        <BarChart3 className="h-6 w-6" />
                      )}
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
                </InteractiveCard>
              ))}
            </div>
          </div>

          {/* Dashboard list */}
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

            {/* Table rows */}
            {isLoading ? (
              <div className="p-6 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              dashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  className="group flex items-center border-b border-border/50 px-6 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                >
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {dashboard.title}
                    </span>
                    {dashboard.favorited && (
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-24">
                    {dashboard.widgetCount ?? 0} widgets
                  </span>
                  <span className="text-xs text-muted-foreground w-32">
                    {dashboard.updatedAt
                      ? new Date(dashboard.updatedAt).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-xs text-muted-foreground w-24">
                    {dashboard.ownerName ?? '-'}
                  </span>
                  <div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="rounded p-0.5 hover:bg-accent">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
