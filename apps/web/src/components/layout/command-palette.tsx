'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Sparkles,
  FileText,
  Hash,
  MessageSquare,
  Bot,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  Clock,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  AnimatePresence,
  ScaleIn,
  StaggerList,
  StaggerItem,
  fadeIn,
  durations,
} from '@/components/motion'

const sourcesTabs = [
  { id: 'all', label: 'All' },
  { id: 'clickup', label: 'ClickUp', icon: '🟣' },
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'gmail', label: 'Gmail', icon: '✉️' },
  { id: 'drive', label: 'Google Drive', icon: '📁' },
]

const filterTabs = [
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'channels', label: 'Channels', icon: Hash },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
]

const demoResults = [
  { id: '1', title: 'Mobile App MVP Development', location: 'General Project Manager', time: '3d ago', status: 'in-progress' as const },
  { id: '2', title: 'General Project Manager', location: 'Space', time: '3d ago', type: 'list' },
  { id: '3', title: 'Project 1', location: 'Team Space', time: '3d ago', type: 'list' },
  { id: '4', title: 'Welcome', location: 'Welcome', time: '3d ago', type: 'doc' },
  { id: '5', title: 'API Integration', location: 'Mobile App MVP Development', time: '3d ago', status: 'in-progress' as const },
  { id: '6', title: 'UI Component Library', location: 'Mobile App MVP Development', time: '3d ago', status: 'in-progress' as const },
  { id: '7', title: 'Press Release Draft', location: 'Product Launch Campaign', time: '3d ago', status: 'todo' as const },
]

const statusIcons: Record<string, React.ReactNode> = {
  'todo': <Circle className="h-3.5 w-3.5 text-status-todo" />,
  'in-progress': <Clock className="h-3.5 w-3.5 text-status-in-progress" />,
  'done': <CheckCircle2 className="h-3.5 w-3.5 text-status-done" />,
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeSource, setActiveSource] = useState('all')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (open) onClose()
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.normal }}
          />

          {/* Modal container */}
          <div className="relative mx-auto mt-20 w-full max-w-2xl">
            <ScaleIn>
              <div className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search, run a command, or ask a question..."
                  />
                  <button className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors">
                    <Sparkles className="h-3 w-3" />
                    Ask AI
                  </button>
                </div>

                {/* Source tabs */}
                <div className="flex items-center gap-1 border-b border-border px-4 py-1.5 overflow-x-auto scrollbar-hide">
                  {sourcesTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSource(tab.id)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                        activeSource === tab.id
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      {tab.icon && <span className="mr-1">{tab.icon}</span>}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 border-b border-border px-4 py-1.5 overflow-x-auto scrollbar-hide">
                  {filterTabs.map(tab => (
                    <button
                      key={tab.id}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors whitespace-nowrap"
                    >
                      <tab.icon className="h-3 w-3" />
                      {tab.label}
                    </button>
                  ))}
                  <span className="text-muted-foreground/50">|</span>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                    <Filter className="h-3 w-3" />
                    Filter
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    Sort
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                  <div className="px-3 py-1.5 text-2xs font-medium text-muted-foreground uppercase">
                    Results
                  </div>
                  <StaggerList>
                    {demoResults.map((result, idx) => (
                      <StaggerItem key={result.id}>
                        <button
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors',
                            idx === 0 && 'bg-accent/50'
                          )}
                        >
                          {result.status ? (
                            statusIcons[result.status] || <Circle className="h-3.5 w-3.5" />
                          ) : result.type === 'list' ? (
                            <List className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : result.type === 'doc' ? (
                            <FileText className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="font-medium">{result.title}</span>
                          <span className="text-xs text-muted-foreground">
                            in {result.location}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">{result.time}</span>
                        </button>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-2xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="h-3 w-3" />
                    <ChevronRight className="h-3 w-3" />
                    <span>
                      Type <kbd className="rounded border border-border bg-muted px-1 font-mono">/</kbd> to view commands, hit <kbd className="rounded border border-border bg-muted px-1 font-mono">tab</kbd> for actions
                    </span>
                  </div>
                  <button className="flex items-center gap-1 hover:text-foreground">
                    <Settings className="h-3 w-3" />
                    Settings
                  </button>
                </div>
              </div>
            </ScaleIn>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
