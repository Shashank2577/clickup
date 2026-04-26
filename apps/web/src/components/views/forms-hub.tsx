'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Star,
  MessageSquareText,
  Briefcase,
  ShoppingCart,
  UserCheck,
  Monitor,
  Plus,
  Search,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface FormTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

interface SidebarNavItem {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
}

// --- Data ---

const sidebarItems: SidebarNavItem[] = [
  { id: 'all', label: 'All Forms', icon: <FileText className="h-4 w-4" />, count: 0 },
  { id: 'my', label: 'My Forms', icon: <FileText className="h-4 w-4" />, count: 0 },
  { id: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" />, count: 0 },
]

const templates: FormTemplate[] = [
  {
    id: 'feedback',
    title: 'Feedback Form',
    description: 'Collect feedback from customers, team members, or stakeholders with customizable questions.',
    icon: <MessageSquareText className="h-6 w-6" />,
    color: '#7B68EE',
  },
  {
    id: 'project-intake',
    title: 'Project Intake',
    description: 'Standardize project requests with fields for scope, timeline, budget, and requirements.',
    icon: <Briefcase className="h-6 w-6" />,
    color: '#3B82F6',
  },
  {
    id: 'order-form',
    title: 'Order Form',
    description: 'Create order forms for products or services with quantities, pricing, and delivery details.',
    icon: <ShoppingCart className="h-6 w-6" />,
    color: '#22C55E',
  },
  {
    id: 'job-application',
    title: 'Job Application',
    description: 'Build application forms with resume upload, experience fields, and screening questions.',
    icon: <UserCheck className="h-6 w-6" />,
    color: '#F97316',
  },
  {
    id: 'it-requests',
    title: 'IT Requests',
    description: 'Manage IT support tickets with priority levels, category selection, and device information.',
    icon: <Monitor className="h-6 w-6" />,
    color: '#EF4444',
  },
  {
    id: 'scratch',
    title: 'Start from scratch',
    description: 'Build a custom form from a blank canvas with drag-and-drop fields.',
    icon: <Plus className="h-6 w-6" />,
    color: '#64748B',
  },
]

// --- Components ---

function FormsSidebar({
  activeItem,
  onItemChange,
}: {
  activeItem: string
  onItemChange: (id: string) => void
}) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-sidebar overflow-y-auto scrollbar-thin">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Forms</h2>
      </div>

      <div className="space-y-0.5 px-2">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemChange(item.id)}
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
            <span className="flex-1 truncate text-left">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className="text-2xs text-muted-foreground">{item.count}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  )
}

function TemplateCard({ template }: { template: FormTemplate }) {
  return (
    <button className="group flex flex-col items-start rounded-lg border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-muted-foreground/30">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: template.color }}
      >
        {template.icon}
      </div>
      <h4 className="text-sm font-medium mb-1">{template.title}</h4>
      <p className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
        {template.description}
      </p>
    </button>
  )
}

// --- Main Component ---

export function FormsHub() {
  const [activeItem, setActiveItem] = useState('all')

  return (
    <div className="flex h-full">
      <FormsSidebar activeItem={activeItem} onItemChange={setActiveItem} />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <h1 className="text-lg font-semibold">Forms</h1>
          <div className="flex items-center gap-2">
            <div className="flex h-7 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search forms...</span>
            </div>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              New Form
            </Button>
          </div>
        </div>

        <div className="p-6">
          {/* Template Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-1">Start with a template</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Choose a template to get started quickly, or build from scratch
            </p>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>

          {/* Your Forms Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Your forms</h3>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Sort by
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <h4 className="text-sm font-medium mb-1">No forms yet</h4>
              <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
                Create your first form to start collecting data from your team or clients
              </p>
              <Button size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Create Form
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
