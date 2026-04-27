'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ListView } from './list-view'
import { BoardView } from './board-view'
import { TaskDetail } from '@/components/task/task-detail'
import {
  Star,
  ChevronDown,
  Bot,
  Zap,
  Sparkles,
  Share2,
  Plus,
  FileText,
  List,
  Columns3,
  GanttChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence, TabContent, FadeIn, springs } from '@/components/motion'
import { useParams } from 'next/navigation'
import { useWorkspaceStore } from '@/stores'

const viewTabs = [
  { id: 'welcome', label: 'Welcome', icon: FileText },
  { id: 'workload', label: 'Team Workload', icon: null },
  { id: 'list', label: 'Work Plan', icon: List },
  { id: 'board', label: 'Kanban Board', icon: Columns3 },
  { id: 'timeline', label: 'Project Timeline', icon: GanttChart },
]

export function SpaceView() {
  const params = useParams<{ spaceId?: string; listId?: string }>()
  const [activeView, setActiveView] = useState('list')
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const spaces = useWorkspaceStore((s) => s.spaces)
  const addFavorite = useWorkspaceStore((s) => s.addFavorite)

  const activeSpace = useMemo(() => spaces.find((s) => s.id === params?.spaceId) ?? spaces[0], [spaces, params?.spaceId])
  const activeList = useMemo(() => activeSpace?.lists.find((l) => l.id === params?.listId) ?? activeSpace?.lists[0], [activeSpace, params?.listId])

  return (
    <div className="flex h-full flex-col" onClick={(e) => {
      // Open task detail when clicking a task row (data-task attribute)
      const target = e.target as HTMLElement
      const taskRow = target.closest('[data-task]')
      if (taskRow) {
        setShowTaskDetail(true)
      }
    }}>
      {/* Space header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-primary" />
          <h1 className="text-sm font-semibold">{activeList?.name ?? 'List'}</h1>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <button className="text-muted-foreground hover:text-yellow-500 transition-colors" onClick={() => activeList?.id && addFavorite('list', activeList.id)}>
            <Star className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={springs.snappy}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <Bot className="h-3 w-3" />
              Agents
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={springs.snappy}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <Zap className="h-3 w-3" />
              Automate
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={springs.snappy}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Ask AI
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={springs.snappy}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <Share2 className="h-3 w-3" />
              Share
            </Button>
          </motion.div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center border-b border-border px-4">
        <button className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" />
          Add Channel
        </button>

        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 border-transparent',
              activeView === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon && <tab.icon className="h-3 w-3" />}
            {tab.label}
            {activeView === tab.id && (
              <motion.div
                layoutId="activeViewTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={springs.snappy}
              />
            )}
          </button>
        ))}

        <button className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" />
          View
        </button>
      </div>

      {/* View content */}
      <TabContent activeKey={activeView} className="flex-1 overflow-hidden">
        {activeView === 'list' && <ListView />}
        {activeView === 'board' && <BoardView />}
        {activeView === 'timeline' && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GanttChart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">Timeline View</p>
              <p className="text-xs text-muted-foreground mt-1">Gantt chart coming soon</p>
            </div>
          </div>
        )}
        {activeView === 'workload' && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm font-medium">Team Workload</p>
              <p className="text-xs text-muted-foreground mt-1">Capacity planning view coming soon</p>
            </div>
          </div>
        )}
        {activeView === 'welcome' && (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Welcome to General Project Manager</h2>
            <p className="text-muted-foreground">
              Use the view tabs above to switch between different ways of viewing your tasks.
            </p>
          </div>
        )}
      </TabContent>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {showTaskDetail && (
          <TaskDetail onClose={() => setShowTaskDetail(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
