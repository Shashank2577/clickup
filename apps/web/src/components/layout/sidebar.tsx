'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Inbox,
  MessageSquare,
  AtSign,
  ListChecks,
  MoreHorizontal,
  Star,
  Hash,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal as Dots,
  Folder,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  href?: string
  active?: boolean
  count?: number
  onClick?: () => void
}

function SidebarItem({ icon, label, href, active, count, onClick }: SidebarItemProps) {
  const content = (
    <div
      className={cn(
        'group flex h-7 items-center gap-2 rounded-md px-2 text-sm transition-colors cursor-pointer',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground/70 hover:bg-accent hover:text-foreground'
      )}
      onClick={onClick}
    >
      <span className="flex h-4 w-4 items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-2xs text-muted-foreground">{count}</span>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function SidebarSection({ title, children, action }: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

interface SpaceItemProps {
  name: string
  color: string
  taskCount?: number
  lists?: { name: string; count?: number }[]
}

function SpaceItem({ name, color, lists = [] }: SpaceItemProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div
        className="group flex h-7 items-center gap-2 rounded-md px-2 text-sm cursor-pointer hover:bg-accent transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center justify-center">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
        <span
          className="h-3 w-3 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 truncate font-medium">{name}</span>
        <span className="hidden group-hover:flex items-center gap-0.5">
          <button className="rounded p-0.5 hover:bg-accent">
            <Dots className="h-3 w-3 text-muted-foreground" />
          </button>
          <button className="rounded p-0.5 hover:bg-accent">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        </span>
      </div>
      {expanded && lists.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {lists.map((list) => (
            <Link
              key={list.name}
              href="#"
              className="flex h-6 items-center gap-2 rounded-md px-2 text-sm text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
            >
              <List className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 truncate">{list.name}</span>
              {list.count !== undefined && (
                <span className="text-2xs text-muted-foreground">{list.count}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-sidebar flex-col border-r border-sidebar-border bg-sidebar overflow-y-auto scrollbar-thin">
      {/* Home section header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-sm font-semibold">Home</span>
      </div>

      {/* Navigation items */}
      <div className="space-y-0.5 px-1">
        <SidebarItem
          icon={<Inbox className="h-4 w-4" />}
          label="Inbox"
          href="/inbox"
        />
        <SidebarItem
          icon={<MessageSquare className="h-4 w-4" />}
          label="Replies"
          href="/replies"
        />
        <SidebarItem
          icon={<AtSign className="h-4 w-4" />}
          label="Assigned Comments"
          href="/assigned-comments"
        />
        <SidebarItem
          icon={<ListChecks className="h-4 w-4" />}
          label="My Tasks"
          href="/my-tasks"
          active
        />
        <SidebarItem
          icon={<MoreHorizontal className="h-4 w-4" />}
          label="More"
        />
      </div>

      {/* Favorites */}
      <SidebarSection title="Favorites">
        <div className="flex flex-col items-center py-4 text-center">
          <Star className="h-5 w-5 text-yellow-400 mb-1" />
          <span className="text-2xs text-muted-foreground">
            Add to your sidebar
          </span>
        </div>
      </SidebarSection>

      {/* Channels */}
      <SidebarSection
        title="Channels"
        action={
          <button className="rounded p-0.5 hover:bg-accent">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        }
      >
        <div className="space-y-0.5 px-1">
          <SidebarItem
            icon={<Hash className="h-4 w-4 text-muted-foreground" />}
            label="General"
            href="/channels/general"
          />
          <SidebarItem
            icon={<Hash className="h-4 w-4 text-muted-foreground" />}
            label="Welcome"
            href="/channels/welcome"
          />
          <SidebarItem
            icon={<Plus className="h-4 w-4" />}
            label="Add Channel"
          />
        </div>
      </SidebarSection>

      {/* Spaces */}
      <SidebarSection
        title="Spaces"
        action={
          <button className="rounded p-0.5 hover:bg-accent">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        }
      >
        <div className="space-y-0.5 px-1">
          <SidebarItem
            icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
            label="All Tasks"
            href="/all-tasks"
          />
          <SpaceItem
            name="Space"
            color="#7B68EE"
            lists={[
              { name: 'General Project Manager', count: 4 },
            ]}
          />
          <SpaceItem
            name="Team Space"
            color="#3B82F6"
            lists={[
              { name: 'Project 1' },
            ]}
          />

          {/* New Space */}
          <SidebarItem
            icon={<Plus className="h-4 w-4" />}
            label="New Space"
          />
        </div>
      </SidebarSection>
    </aside>
  )
}
