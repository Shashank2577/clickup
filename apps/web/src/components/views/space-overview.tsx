'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Star,
  Plus,
  FolderOpen,
  List,
  FileText,
  Bookmark,
  Clock,
  MoreHorizontal,
  ChevronRight,
  CheckCircle2,
  Circle,
  GitBranch,
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
interface SpaceFolder {
  id: string
  name: string
  listCount: number
  color: string
}

interface SpaceList {
  id: string
  name: string
  taskCount: number
  completedCount: number
  inProgressCount: number
  todoCount: number
}

interface RecentItem {
  id: string
  title: string
  type: 'task' | 'doc' | 'list'
  updatedAt: string
}

interface SpaceDoc {
  id: string
  title: string
  author: string
  authorInitial: string
  authorColor: string
  updatedAt: string
}

interface SpaceBookmark {
  id: string
  title: string
  url: string
  icon: string
}

// Demo data
const demoFolders: SpaceFolder[] = [
  { id: 'f1', name: 'Sprint Planning', listCount: 3, color: 'bg-blue-500' },
  { id: 'f2', name: 'Product Roadmap', listCount: 2, color: 'bg-purple-500' },
  { id: 'f3', name: 'Engineering', listCount: 5, color: 'bg-green-500' },
]

const demoLists: SpaceList[] = [
  { id: 'l1', name: 'Backlog', taskCount: 24, completedCount: 8, inProgressCount: 5, todoCount: 11 },
  { id: 'l2', name: 'Sprint 12 - Active', taskCount: 18, completedCount: 12, inProgressCount: 4, todoCount: 2 },
  { id: 'l3', name: 'Bug Tracker', taskCount: 9, completedCount: 3, inProgressCount: 2, todoCount: 4 },
  { id: 'l4', name: 'Feature Requests', taskCount: 15, completedCount: 0, inProgressCount: 1, todoCount: 14 },
]

const demoRecentItems: RecentItem[] = [
  { id: 'r1', title: 'Mobile App MVP Development', type: 'task', updatedAt: '2 hours ago' },
  { id: 'r2', title: 'Q2 Product Roadmap', type: 'doc', updatedAt: '4 hours ago' },
  { id: 'r3', title: 'API Integration', type: 'task', updatedAt: '5 hours ago' },
  { id: 'r4', title: 'Sprint 12 - Active', type: 'list', updatedAt: 'Yesterday' },
]

const demoDocs: SpaceDoc[] = [
  { id: 'd1', title: 'Q2 Product Roadmap', author: 'Shashank', authorInitial: 'S', authorColor: 'bg-primary', updatedAt: 'Apr 25, 2026' },
  { id: 'd2', title: 'API Documentation v2', author: 'Alex', authorInitial: 'A', authorColor: 'bg-green-500', updatedAt: 'Apr 23, 2026' },
  { id: 'd3', title: 'Architecture Decision Records', author: 'Jordan', authorInitial: 'J', authorColor: 'bg-purple-500', updatedAt: 'Apr 20, 2026' },
]

const demoBookmarks: SpaceBookmark[] = [
  { id: 'b1', title: 'Figma Design System', url: 'figma.com', icon: '🎨' },
  { id: 'b2', title: 'GitHub Repository', url: 'github.com', icon: '🔗' },
  { id: 'b3', title: 'Confluence Wiki', url: 'confluence.com', icon: '📖' },
]

function FolderCard({ folder }: { folder: SpaceFolder }) {
  return (
    <InteractiveCard className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 cursor-pointer">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', folder.color + '/10')}>
        <FolderOpen className={cn('h-4.5 w-4.5', folder.color.replace('bg-', 'text-'))} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold truncate">{folder.name}</h4>
        <p className="text-2xs text-muted-foreground">{folder.listCount} lists</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </InteractiveCard>
  )
}

function ListItem({ list }: { list: SpaceList }) {
  const completionPct = Math.round((list.completedCount / list.taskCount) * 100)

  return (
    <InteractiveRow className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer">
      <List className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{list.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-status-done" />
          <span>{list.completedCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Clock className="h-3 w-3 text-status-in-progress" />
          <span>{list.inProgressCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Circle className="h-3 w-3 text-status-todo" />
          <span>{list.todoCount}</span>
        </div>
        <span className="text-2xs text-muted-foreground w-12 text-right">{list.taskCount} tasks</span>
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-status-done rounded-full transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    </InteractiveRow>
  )
}

export function SpaceOverview({ spaceId }: { spaceId: string }) {
  const [favorited, setFavorited] = useState(false)

  return (
    <div className="h-full flex flex-col">
      {/* Space header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-primary" />
          <h1 className="text-lg font-semibold">General Project Manager</h1>
          <button
            onClick={() => setFavorited(!favorited)}
            className="text-muted-foreground hover:text-yellow-500 transition-colors"
          >
            <Star className={cn('h-4 w-4', favorited && 'text-yellow-400 fill-yellow-400')} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
          {/* Top cards row */}
          <StaggerList className="grid grid-cols-3 gap-4">
            {/* Recent items */}
            <StaggerItem>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Recent Items</h3>
                </div>
                <div className="space-y-2">
                  {demoRecentItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-1 text-sm hover:bg-accent/50 rounded px-1.5 -mx-1.5 cursor-pointer transition-colors"
                    >
                      {item.type === 'task' && <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {item.type === 'doc' && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {item.type === 'list' && <List className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className="flex-1 truncate text-xs">{item.title}</span>
                      <span className="text-2xs text-muted-foreground shrink-0">{item.updatedAt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>

            {/* Docs in this space */}
            <StaggerItem>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Docs in this Space</h3>
                </div>
                <div className="space-y-2">
                  {demoDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 py-1 hover:bg-accent/50 rounded px-1.5 -mx-1.5 cursor-pointer transition-colors"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-xs">{doc.title}</span>
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className={cn('text-[9px]', doc.authorColor)}>{doc.authorInitial}</AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>

            {/* Bookmarks */}
            <StaggerItem>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Bookmarks</h3>
                </div>
                <div className="space-y-2">
                  {demoBookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="flex items-center gap-2 py-1 hover:bg-accent/50 rounded px-1.5 -mx-1.5 cursor-pointer transition-colors"
                    >
                      <span className="text-sm shrink-0">{bookmark.icon}</span>
                      <span className="flex-1 truncate text-xs">{bookmark.title}</span>
                      <span className="text-2xs text-muted-foreground shrink-0">{bookmark.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>
          </StaggerList>

          {/* Folders section */}
          <FadeIn delay={0.1}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Folders</h2>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Add Folder
                </Button>
              </div>
              <StaggerList className="grid grid-cols-3 gap-3">
                {demoFolders.map((folder) => (
                  <StaggerItem key={folder.id}>
                    <FolderCard folder={folder} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          </FadeIn>

          {/* Lists section */}
          <FadeIn delay={0.2}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Lists</h2>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Add List
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {/* List table header */}
                <div className="flex items-center gap-3 px-4 py-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                  <span className="w-4" />
                  <span className="flex-1">Name</span>
                  <span className="w-64 text-right">Status Summary</span>
                </div>
                {demoLists.map((list) => (
                  <ListItem key={list.id} list={list} />
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
