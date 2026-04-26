'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Tags,
  Eye,
  MoreHorizontal,
  Star,
  Lock,
  Users,
  Archive,
  Clock,
  FolderOpen,
  BookOpen,
  Presentation,
  StickyNote,
  Globe,
  Import,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Sidebar navigation items
type DocSidebarItem = {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
  active?: boolean
}

const sidebarItems: DocSidebarItem[] = [
  { id: 'all', label: 'All Docs', icon: <FileText className="h-4 w-4" />, active: true },
  { id: 'my-docs', label: 'My Docs', icon: <FolderOpen className="h-4 w-4" />, count: 3 },
  { id: 'shared', label: 'Shared with me', icon: <Users className="h-4 w-4" /> },
  { id: 'private', label: 'Private', icon: <Lock className="h-4 w-4" /> },
  { id: 'meeting-notes', label: 'Meeting Notes', icon: <StickyNote className="h-4 w-4" /> },
  { id: 'archived', label: 'Archived', icon: <Archive className="h-4 w-4" /> },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
]

// Template items
interface DocTemplate {
  id: string
  title: string
  icon: React.ReactNode
  color: string
}

const templates: DocTemplate[] = [
  {
    id: 'project-overview',
    title: 'Project Overview',
    icon: <Presentation className="h-5 w-5" />,
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    icon: <StickyNote className="h-5 w-5" />,
    color: 'bg-green-500/10 text-green-500',
  },
  {
    id: 'wiki',
    title: 'Wiki',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-purple-500/10 text-purple-500',
  },
]

// Doc data
interface Doc {
  id: string
  title: string
  location: string
  tags: string[]
  dateUpdated: string
  dateViewed: string
  sharing: 'workspace' | 'private' | 'shared'
  author: string
  authorInitial: string
  authorColor: string
  favorited: boolean
}

const demoDocs: Doc[] = [
  {
    id: '1',
    title: 'Q2 Product Roadmap',
    location: 'Space / General Project Manager',
    tags: ['roadmap', 'product'],
    dateUpdated: 'Apr 25, 2026',
    dateViewed: 'Apr 26, 2026',
    sharing: 'workspace',
    author: 'Shashank',
    authorInitial: 'S',
    authorColor: 'bg-primary',
    favorited: true,
  },
  {
    id: '2',
    title: 'API Documentation v2',
    location: 'Space / General Project Manager',
    tags: ['api', 'engineering'],
    dateUpdated: 'Apr 23, 2026',
    dateViewed: 'Apr 24, 2026',
    sharing: 'shared',
    author: 'Alex',
    authorInitial: 'A',
    authorColor: 'bg-green-500',
    favorited: false,
  },
  {
    id: '3',
    title: 'Weekly Standup Notes - April',
    location: 'Team Space / Project 1',
    tags: ['meetings'],
    dateUpdated: 'Apr 21, 2026',
    dateViewed: 'Apr 22, 2026',
    sharing: 'workspace',
    author: 'Jordan',
    authorInitial: 'J',
    authorColor: 'bg-purple-500',
    favorited: false,
  },
]

const sharingIcons: Record<string, React.ReactNode> = {
  workspace: <Globe className="h-3.5 w-3.5 text-muted-foreground" />,
  private: <Lock className="h-3.5 w-3.5 text-muted-foreground" />,
  shared: <Users className="h-3.5 w-3.5 text-muted-foreground" />,
}

function DocsSidebar({ activeItem, onItemClick }: { activeItem: string; onItemClick: (id: string) => void }) {
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

function TemplateRow() {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Start from a template</h3>
        <button className="text-2xs text-primary hover:underline flex items-center gap-0.5">
          View all
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 hover:bg-accent/50 hover:border-border transition-colors"
          >
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', template.color)}>
              {template.icon}
            </span>
            <span className="text-sm font-medium">{template.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function DocsToolbar() {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-1.5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Filter className="h-3 w-3" />
          Filters
        </Button>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <ArrowUpDown className="h-3 w-3" />
          Sort
        </Button>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Tags className="h-3 w-3" />
          Tags
        </Button>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Eye className="h-3 w-3" />
          View all
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function DocsTable() {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Table header */}
      <div className="flex items-center border-b border-border px-6 py-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-48 text-left">Location</div>
        <div className="w-28 text-left">Tags</div>
        <div className="w-28 text-left flex items-center gap-1 cursor-pointer hover:text-foreground">
          Date updated
          <ArrowUpDown className="h-2.5 w-2.5" />
        </div>
        <div className="w-28 text-left">Date viewed</div>
        <div className="w-16 text-center">Sharing</div>
        <div className="w-8" />
      </div>

      {/* Table rows */}
      {demoDocs.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center border-b border-border/50 px-6 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
        >
          {/* Name */}
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{doc.title}</span>
            {doc.favorited && (
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />
            )}
          </div>

          {/* Location */}
          <div className="w-48 text-xs text-muted-foreground truncate">
            {doc.location}
          </div>

          {/* Tags */}
          <div className="w-28 flex items-center gap-1 overflow-hidden">
            {doc.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-2xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Date updated */}
          <div className="w-28 text-xs text-muted-foreground">
            {doc.dateUpdated}
          </div>

          {/* Date viewed */}
          <div className="w-28 text-xs text-muted-foreground">
            {doc.dateViewed}
          </div>

          {/* Sharing */}
          <div className="w-16 flex justify-center">
            {sharingIcons[doc.sharing]}
          </div>

          {/* More */}
          <div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="rounded p-0.5 hover:bg-accent">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DocsHub() {
  const [activeSidebarItem, setActiveSidebarItem] = useState('all')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Docs Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Import className="h-3 w-3" />
            Import
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="h-3 w-3" />
            New Doc
          </Button>
        </div>
      </div>

      {/* Body with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <DocsSidebar activeItem={activeSidebarItem} onItemClick={setActiveSidebarItem} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <TemplateRow />
          <DocsToolbar />
          <DocsTable />
        </div>
      </div>
    </div>
  )
}
