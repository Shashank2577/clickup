'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, MessageSquare, AtSign, ListChecks, MoreHorizontal, Star, Hash, Plus, ChevronRight, ChevronDown, MoreHorizontal as Dots, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { motion, AnimatePresence, InteractiveRow, StaggerList, StaggerItem, springs, durations, Skeleton } from '@/components/motion'
import { useAuthStore, useWorkspaceStore } from '@/stores'

interface SidebarItemProps { icon: React.ReactNode; label: string; href?: string; active?: boolean; count?: number; onClick?: () => void }
function SidebarItem({ icon, label, href, active, count, onClick }: SidebarItemProps) {
  const content = (
    <InteractiveRow className={cn('group flex h-7 items-center gap-2 rounded-md px-2 text-sm transition-colors cursor-pointer', active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 hover:text-foreground')} onClick={onClick}>
      <span className="flex h-4 w-4 items-center justify-center shrink-0">{icon}</span><span className="flex-1 truncate">{label}</span>{count !== undefined && <span className="text-2xs text-muted-foreground">{count}</span>}
    </InteractiveRow>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function SidebarSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="py-1.5"><div className="flex items-center justify-between px-2 py-1"><span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>{action}</div>{children}</div>
}

function SpaceItem({ spaceId, name, color, lists, onCreateList }: { spaceId: string; name: string; color: string; lists: { id: string; name: string; count?: number }[]; onCreateList: (spaceId: string) => void }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <div className="group flex h-7 items-center gap-2 rounded-md px-2 text-sm cursor-pointer hover:bg-accent transition-colors" onClick={() => setExpanded(!expanded)}>
        <span className="flex items-center justify-center">{expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}</span>
        <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span className="flex-1 truncate font-medium">{name}</span>
        <span className="hidden group-hover:flex items-center gap-0.5">
          <button className="rounded p-0.5 hover:bg-accent"><Dots className="h-3 w-3 text-muted-foreground" /></button>
          <button className="rounded p-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); onCreateList(spaceId) }}><Plus className="h-3 w-3 text-muted-foreground" /></button>
        </span>
      </div>
      <AnimatePresence initial={false}>{expanded && lists.length > 0 && <motion.div className="ml-4 mt-0.5 space-y-0.5 overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: springs.gentle }} exit={{ height: 0, opacity: 0, transition: { duration: durations.fast } }}>{lists.map((list) => <InteractiveRow key={list.id}><Link href={`/spaces/${spaceId}/${list.id}`} className="flex h-6 items-center gap-2 rounded-md px-2 text-sm text-foreground/70 hover:text-foreground transition-colors"><List className="h-3 w-3 text-muted-foreground" /><span className="flex-1 truncate">{list.name}</span>{list.count !== undefined && <span className="text-2xs text-muted-foreground">{list.count}</span>}</Link></InteractiveRow>)}</motion.div>}</AnimatePresence>
    </div>
  )
}

export function Sidebar() {
  const workspace = useAuthStore((s) => s.workspace)
  const { spaces, favorites, isLoading, createSpace, createList } = useWorkspaceStore()
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const [dms, setDms] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    async function loadChatData() {
      if (!workspace?.id) return
      try {
        const [channelsRes, dmsRes] = await Promise.all([
          api.get<{ id: string; name: string }[]>('/channels', { params: { workspaceId: workspace.id } }),
          api.get<{ id: string; name: string }[]>('/dm', { params: { workspaceId: workspace.id } }),
        ])
        setChannels(channelsRes)
        setDms(dmsRes)
      } catch {
        setChannels([])
        setDms([])
      }
    }
    loadChatData()
  }, [workspace?.id])

  return (
    <motion.aside className="flex h-full w-sidebar flex-col border-r border-sidebar-border bg-sidebar overflow-y-auto scrollbar-thin" initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={springs.gentle}>
      <div className="flex items-center justify-between px-3 pt-2 pb-1"><span className="text-sm font-semibold">Home</span></div>
      <div className="space-y-0.5 px-1">
        <SidebarItem icon={<Inbox className="h-4 w-4" />} label="Inbox" href="/inbox" />
        <SidebarItem icon={<MessageSquare className="h-4 w-4" />} label="Replies" href="/replies" />
        <SidebarItem icon={<AtSign className="h-4 w-4" />} label="Assigned Comments" href="/assigned-comments" />
        <SidebarItem icon={<ListChecks className="h-4 w-4" />} label="My Tasks" href="/my-tasks" active />
        <SidebarItem icon={<MoreHorizontal className="h-4 w-4" />} label="More" />
      </div>

      <StaggerList>
        <StaggerItem>
          <SidebarSection title="Favorites">{favorites.length === 0 ? <div className="flex flex-col items-center py-4 text-center"><Star className="h-5 w-5 text-yellow-400 mb-1" /><span className="text-2xs text-muted-foreground">Add to your sidebar</span></div> : <div className="space-y-0.5 px-1">{favorites.map((fav) => <SidebarItem key={fav.id} icon={<Star className="h-4 w-4 text-yellow-400" />} label={fav.entityName} />)}</div>}</SidebarSection>
        </StaggerItem>

        <StaggerItem>
          <SidebarSection title="Channels" action={<button className="rounded p-0.5 hover:bg-accent"><Plus className="h-3 w-3 text-muted-foreground" /></button>}>
            <div className="space-y-0.5 px-1">
              {channels.map((channel) => <SidebarItem key={channel.id} icon={<Hash className="h-4 w-4 text-muted-foreground" />} label={channel.name} href={`/channels/${channel.id}`} />)}
              {dms.map((dm) => <SidebarItem key={dm.id} icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />} label={dm.name} />)}
              <SidebarItem icon={<Plus className="h-4 w-4" />} label="Add Channel" />
            </div>
          </SidebarSection>
        </StaggerItem>

        <StaggerItem>
          <SidebarSection title="Spaces" action={<button className="rounded p-0.5 hover:bg-accent" onClick={() => workspace?.id && createSpace(workspace.id, 'New Space', '#7B68EE')}><Plus className="h-3 w-3 text-muted-foreground" /></button>}>
            <div className="space-y-0.5 px-1">
              <SidebarItem icon={<ListChecks className="h-4 w-4 text-muted-foreground" />} label="All Tasks" href="/all-tasks" />
              {isLoading ? <Skeleton className="h-24 w-full" /> : spaces.map((space) => <SpaceItem key={space.id} spaceId={space.id} name={space.name} color={space.color} lists={space.lists.map((l) => ({ id: l.id, name: l.name, count: l.taskCount }))} onCreateList={(spaceId) => createList(spaceId, 'New List')} />)}
              <SidebarItem icon={<Plus className="h-4 w-4" />} label="New Space" onClick={() => workspace?.id && createSpace(workspace.id, 'New Space', '#7B68EE')} />
            </div>
          </SidebarSection>
        </StaggerItem>
      </StaggerList>
    </motion.aside>
  )
}
