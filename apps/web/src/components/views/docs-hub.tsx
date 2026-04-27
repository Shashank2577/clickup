'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, Search, Filter, ArrowUpDown, Tags, Eye, MoreHorizontal, Star, Lock, Users, Archive, FolderOpen, BookOpen, Presentation, StickyNote, Globe, Import, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, InteractiveRow, InteractiveCard, Skeleton } from '@/components/motion'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores'

const sidebarItems = [
  { id: 'all', label: 'All Docs', icon: <FileText className="h-4 w-4" /> },
  { id: 'my-docs', label: 'My Docs', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'shared', label: 'Shared with me', icon: <Users className="h-4 w-4" /> },
  { id: 'private', label: 'Private', icon: <Lock className="h-4 w-4" /> },
  { id: 'meeting-notes', label: 'Meeting Notes', icon: <StickyNote className="h-4 w-4" /> },
  { id: 'archived', label: 'Archived', icon: <Archive className="h-4 w-4" /> },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
]

const sharingIcons: Record<string, React.ReactNode> = {
  workspace: <Globe className="h-3.5 w-3.5 text-muted-foreground" />,
  private: <Lock className="h-3.5 w-3.5 text-muted-foreground" />,
  shared: <Users className="h-3.5 w-3.5 text-muted-foreground" />,
}

export function DocsHub() {
  const router = useRouter()
  const workspace = useAuthStore((s) => s.workspace)
  const [activeSidebarItem, setActiveSidebarItem] = useState('all')
  const [docs, setDocs] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function load() {
      if (!workspace?.id) return
      setIsLoading(true)
      try {
        const [d, t] = await Promise.all([
          api.get<any[]>('/docs', { params: { workspaceId: workspace.id, filter: activeSidebarItem } }),
          api.get<any[]>('/docs/templates', { params: { workspaceId: workspace.id } }),
        ])
        setDocs(d)
        setTemplates(t)
      } catch {
        setDocs([]); setTemplates([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [workspace?.id, activeSidebarItem])

  return <div className="h-full flex flex-col">
    <div className="flex items-center justify-between border-b border-border px-6 py-3"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-foreground" /><h1 className="text-lg font-semibold">Docs Hub</h1></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="gap-1 text-xs"><Import className="h-3 w-3" />Import</Button><Button size="sm" className="gap-1" onClick={() => api.post('/docs', { body: { workspaceId: workspace?.id, title: 'Untitled Doc' } })}><Plus className="h-3 w-3" />New Doc</Button></div></div>
    <div className="flex flex-1 overflow-hidden">
      <div className="w-56 border-r border-border bg-muted/30 p-3 shrink-0"><div className="space-y-0.5">{sidebarItems.map((item) => <InteractiveRow key={item.id} onClick={() => setActiveSidebarItem(item.id)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer', activeSidebarItem === item.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70')}><span className="flex h-4 w-4 items-center justify-center shrink-0">{item.icon}</span><span className="flex-1 text-left truncate">{item.label}</span></InteractiveRow>)}</div></div>
      <FadeIn className="flex-1 overflow-y-auto">
        <div className="border-b border-border px-6 py-4"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-medium text-muted-foreground">Start from a template</h3><button className="text-2xs text-primary hover:underline flex items-center gap-0.5">View all<ChevronRight className="h-3 w-3" /></button></div><div className="flex items-center gap-3">{templates.slice(0,3).map((template) => <InteractiveCard key={template.id} className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 cursor-pointer" onClick={() => api.post('/docs', { body: { workspaceId: workspace?.id, templateId: template.id } })}><span className={cn('flex h-8 w-8 items-center justify-center rounded-md','bg-blue-500/10 text-blue-500')}>{template.type === 'presentation' ? <Presentation className='h-5 w-5'/> : template.type === 'notes' ? <StickyNote className='h-5 w-5'/> : <BookOpen className='h-5 w-5'/>}</span><span className="text-sm font-medium">{template.title}</span></InteractiveCard>)}</div></div>
        <div className="flex items-center justify-between border-b border-border px-6 py-1.5"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" className="text-xs gap-1"><Filter className="h-3 w-3" />Filters</Button><Button variant="ghost" size="sm" className="text-xs gap-1"><ArrowUpDown className="h-3 w-3" />Sort</Button><Button variant="ghost" size="sm" className="text-xs gap-1"><Tags className="h-3 w-3" />Tags</Button><Button variant="ghost" size="sm" className="text-xs gap-1"><Eye className="h-3 w-3" />View all</Button></div><Button variant="ghost" size="icon-sm"><Search className="h-3.5 w-3.5" /></Button></div>
        <div className="flex-1 overflow-y-auto">{isLoading ? <div className='p-6 space-y-2'><Skeleton className='h-8 w-full'/><Skeleton className='h-8 w-full'/></div> : docs.map((doc) => <div key={doc.id} className="group flex items-center border-b border-border/50 px-6 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push(`/docs/${doc.id}`)}><div className="flex flex-1 items-center gap-3 min-w-0"><FileText className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-sm font-medium truncate">{doc.title}</span>{doc.favorited && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />}</div><div className="w-48 text-xs text-muted-foreground truncate">{doc.location ?? '-'}</div><div className="w-28 flex items-center gap-1 overflow-hidden">{(doc.tags ?? []).slice(0,2).map((tag: string) => <Badge key={tag} variant="secondary" className="text-2xs px-1.5 py-0">{tag}</Badge>)}</div><div className="w-28 text-xs text-muted-foreground">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '-'}</div><div className="w-28 text-xs text-muted-foreground">{doc.viewedAt ? new Date(doc.viewedAt).toLocaleDateString() : '-'}</div><div className="w-16 flex justify-center">{sharingIcons[doc.sharing ?? 'workspace']}</div><div className="w-8 opacity-0 group-hover:opacity-100 transition-opacity"><button className="rounded p-0.5 hover:bg-accent"><MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" /></button></div></div>)}</div>
      </FadeIn>
    </div>
  </div>
}
