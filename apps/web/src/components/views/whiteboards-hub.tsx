'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus,
  PenTool,
  Star,
  Search,
  MoreHorizontal,
  Users,
  GitBranch,
  Lightbulb,
  Route,
  Network,
  LayoutGrid,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FadeIn,
  StaggerList,
  StaggerItem,
  InteractiveCard,
  InteractiveRow,
} from '@/components/motion'

// Types
interface WhiteboardTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

interface Whiteboard {
  id: string
  title: string
  lastUpdated: string
  owner: string
  collaborators: number
  favorited: boolean
  previewColor: string
}

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
}

// Demo data
const sidebarItems: SidebarItem[] = [
  { id: 'all', label: 'All Whiteboards', icon: <PenTool className="h-4 w-4" /> },
  { id: 'my', label: 'My Whiteboards', icon: <LayoutGrid className="h-4 w-4" />, count: 2 },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" />, count: 1 },
]

const templates: WhiteboardTemplate[] = [
  {
    id: 't1',
    title: 'Organizational Chart',
    description: 'Map your team structure and reporting lines.',
    icon: <Network className="h-5 w-5" />,
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    id: 't2',
    title: 'Action Plan',
    description: 'Plan and track initiatives with visual workflows.',
    icon: <Route className="h-5 w-5" />,
    color: 'bg-green-500/10 text-green-500',
  },
  {
    id: 't3',
    title: 'Customer Journey Map',
    description: 'Visualize the customer experience from start to finish.',
    icon: <GitBranch className="h-5 w-5" />,
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    id: 't4',
    title: 'Brainstorm',
    description: 'Capture and organize ideas with your team in real time.',
    icon: <Lightbulb className="h-5 w-5" />,
    color: 'bg-orange-500/10 text-orange-500',
  },
]

const demoWhiteboards: Whiteboard[] = [
  {
    id: 'wb1',
    title: 'Product Architecture Diagram',
    lastUpdated: 'Apr 25, 2026',
    owner: 'Shashank',
    collaborators: 3,
    favorited: true,
    previewColor: 'from-blue-500/20 to-purple-500/20',
  },
  {
    id: 'wb2',
    title: 'Sprint Retrospective Board',
    lastUpdated: 'Apr 22, 2026',
    owner: 'Taylor',
    collaborators: 5,
    favorited: false,
    previewColor: 'from-green-500/20 to-teal-500/20',
  },
  {
    id: 'wb3',
    title: 'User Flow - Onboarding',
    lastUpdated: 'Apr 18, 2026',
    owner: 'Alex',
    collaborators: 2,
    favorited: false,
    previewColor: 'from-orange-500/20 to-red-500/20',
  },
  {
    id: 'wb4',
    title: 'Q3 Planning Mindmap',
    lastUpdated: 'Apr 15, 2026',
    owner: 'Jordan',
    collaborators: 4,
    favorited: false,
    previewColor: 'from-pink-500/20 to-rose-500/20',
  },
]

function WhiteboardSidebar({
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
          <InteractiveRow
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer',
              activeItem === item.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground/70'
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              {item.icon}
            </span>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.count !== undefined && (
              <span className="text-2xs text-muted-foreground">{item.count}</span>
            )}
          </InteractiveRow>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: WhiteboardTemplate }) {
  return (
    <InteractiveCard className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 cursor-pointer">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', template.color)}>
        {template.icon}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-medium truncate">{template.title}</h4>
        <p className="text-2xs text-muted-foreground truncate">{template.description}</p>
      </div>
    </InteractiveCard>
  )
}

function WhiteboardCard({ whiteboard }: { whiteboard: Whiteboard }) {
  return (
    <InteractiveCard className="group rounded-lg border border-border bg-card overflow-hidden cursor-pointer">
      {/* Preview placeholder */}
      <div className={cn('h-36 bg-gradient-to-br relative', whiteboard.previewColor)}>
        {/* Fake whiteboard content */}
        <div className="absolute inset-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 opacity-40">
            <div className="flex gap-4">
              <div className="h-8 w-16 rounded border border-current" />
              <div className="h-8 w-16 rounded border border-current" />
            </div>
            <div className="h-px w-12 bg-current" />
            <div className="flex gap-4">
              <div className="h-8 w-16 rounded border border-current" />
              <div className="h-8 w-16 rounded border border-current" />
              <div className="h-8 w-16 rounded border border-current" />
            </div>
          </div>
        </div>
        {/* Favorite */}
        {whiteboard.favorited && (
          <div className="absolute top-2 right-2">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
          </div>
        )}
        {/* More menu */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="rounded bg-background/80 p-1 hover:bg-background transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5 text-foreground" />
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium truncate mb-1">{whiteboard.title}</h4>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {whiteboard.lastUpdated}
          </div>
          <div className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {whiteboard.collaborators}
          </div>
        </div>
      </div>
    </InteractiveCard>
  )
}

export function WhiteboardsHub() {
  const [activeSidebarItem, setActiveSidebarItem] = useState('all')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Whiteboards</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm">
            <Search className="h-4 w-4" />
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="h-3 w-3" />
            New Whiteboard
          </Button>
        </div>
      </div>

      {/* Body with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <WhiteboardSidebar activeItem={activeSidebarItem} onItemClick={setActiveSidebarItem} />

        <FadeIn className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Templates section */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-semibold mb-3">Start from a template</h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>

          {/* Whiteboards grid */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-3 pt-3 border-t border-border">
              <h3 className="text-sm font-semibold">Recent Whiteboards</h3>
            </div>
            <StaggerList className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {demoWhiteboards.map((wb) => (
                <StaggerItem key={wb.id}>
                  <WhiteboardCard whiteboard={wb} />
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
