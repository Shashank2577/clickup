'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Star, MessageSquareText, Briefcase, ShoppingCart, UserCheck, Monitor, Plus, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, InteractiveRow, InteractiveCard, Skeleton } from '@/components/motion'
import { api } from '@/lib/api-client'
import { useAuthStore, useWorkspaceStore } from '@/stores'

const defaultTemplates = [
  { id: 'feedback', title: 'Feedback Form', description: 'Collect feedback.', icon: <MessageSquareText className='h-6 w-6'/>, color: '#7B68EE' },
  { id: 'project-intake', title: 'Project Intake', description: 'Standardize project requests.', icon: <Briefcase className='h-6 w-6'/>, color: '#3B82F6' },
  { id: 'order-form', title: 'Order Form', description: 'Create order forms.', icon: <ShoppingCart className='h-6 w-6'/>, color: '#22C55E' },
  { id: 'job-application', title: 'Job Application', description: 'Build application forms.', icon: <UserCheck className='h-6 w-6'/>, color: '#F97316' },
  { id: 'it-requests', title: 'IT Requests', description: 'Manage IT support tickets.', icon: <Monitor className='h-6 w-6'/>, color: '#EF4444' },
  { id: 'scratch', title: 'Start from scratch', description: 'Build custom form.', icon: <Plus className='h-6 w-6'/>, color: '#64748B' },
]

export function FormsHub() {
  const workspace = useAuthStore((s) => s.workspace)
  const spaces = useWorkspaceStore((s) => s.spaces)
  const firstListId = spaces[0]?.lists[0]?.id
  const [activeItem, setActiveItem] = useState('all')
  const [forms, setForms] = useState<any[]>([])
  const [templates, setTemplates] = useState(defaultTemplates)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      if (!workspace?.id) return
      setLoading(true)
      try {
        const data = await api.get<any[]>('/forms', { params: { workspaceId: workspace.id } })
        setForms(data)
      } catch { setForms([]) } finally { setLoading(false) }
    }
    load()
  }, [workspace?.id, activeItem])

  async function createForm(templateId?: string) {
    if (!firstListId) return
    await api.post(`/task-forms/lists/${firstListId}/forms`, { body: { title: 'New Form', templateId } })
    if (workspace?.id) setForms(await api.get<any[]>('/forms', { params: { workspaceId: workspace.id } }))
  }

  const sidebarItems = [
    { id: 'all', label: 'All Forms', icon: <FileText className='h-4 w-4' />, count: forms.length },
    { id: 'my', label: 'My Forms', icon: <FileText className='h-4 w-4' />, count: 0 },
    { id: 'favorites', label: 'Favorites', icon: <Star className='h-4 w-4' />, count: 0 },
  ]

  return <div className='flex h-full'><aside className='flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-sidebar overflow-y-auto scrollbar-thin'><div className='px-4 pt-4 pb-2'><h2 className='text-sm font-semibold'>Forms</h2></div><div className='space-y-0.5 px-2'>{sidebarItems.map((item) => <InteractiveRow key={item.id} onClick={() => setActiveItem(item.id)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer', activeItem===item.id ? 'bg-primary/10 text-primary font-medium':'text-foreground/70')}><span className='flex h-4 w-4 items-center justify-center shrink-0'>{item.icon}</span><span className='flex-1 truncate text-left'>{item.label}</span>{item.count>0 && <span className='text-2xs text-muted-foreground'>{item.count}</span>}</InteractiveRow>)}</div></aside>
    <FadeIn className='flex-1 overflow-y-auto scrollbar-thin'><div className='flex items-center justify-between border-b border-border px-6 py-3'><h1 className='text-lg font-semibold'>Forms</h1><div className='flex items-center gap-2'><div className='flex h-7 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground'><Search className='h-3.5 w-3.5' /><span className='text-xs'>Search forms...</span></div><Button size='sm' className='gap-1' onClick={() => createForm()}><Plus className='h-3.5 w-3.5' />New Form</Button></div></div>
      <div className='p-6'><div className='mb-8'><h3 className='text-sm font-semibold mb-1'>Start with a template</h3><p className='text-xs text-muted-foreground mb-4'>Choose a template to get started quickly.</p><div className='grid grid-cols-3 gap-3'>{templates.map((template) => <InteractiveCard key={template.id} className='group flex flex-col items-start rounded-lg border border-border bg-card p-4 text-left cursor-pointer' onClick={() => createForm(template.id)}><div className='mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white' style={{ backgroundColor: template.color }}>{template.icon}</div><h4 className='text-sm font-medium mb-1'>{template.title}</h4><p className='text-2xs text-muted-foreground leading-relaxed line-clamp-2'>{template.description}</p></InteractiveCard>)}</div></div>
        <div><div className='flex items-center justify-between mb-4'><h3 className='text-sm font-semibold'>Your forms</h3><Button variant='ghost' size='sm' className='text-xs gap-1'>Sort by<ChevronDown className='h-3 w-3' /></Button></div>
          {loading ? <Skeleton className='h-20 w-full' /> : forms.length === 0 ? <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16'><div className='flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4'><FileText className='h-7 w-7 text-muted-foreground/50' /></div><h4 className='text-sm font-medium mb-1'>No forms yet</h4><Button size='sm' className='gap-1' onClick={() => createForm()}><Plus className='h-3.5 w-3.5' />Create Form</Button></div> : <div className='space-y-2'>{forms.map((form) => <div key={form.id} className='rounded-lg border border-border p-4'><div className='font-medium text-sm'>{form.title}</div><div className='text-xs text-muted-foreground mt-1'>{form.description ?? 'No description'}</div></div>)}</div>}
        </div></div>
    </FadeIn></div>
}
