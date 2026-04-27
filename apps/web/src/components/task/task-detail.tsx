'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  X,
  Star,
  Pin,
  Share2,
  Sparkles,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Flag,
  Calendar,
  Clock,
  Tag,
  Link2,
  Eye,
  EyeOff,
  FileText,
  CheckCircle2,
  Circle,
  GitBranch,
  Paperclip,
  Upload,
  Search,
  SlidersHorizontal,
  Settings,
  SmilePlus,
  Mic,
  AtSign,
  Code,
  Clipboard,
  Send,
  ArrowUpRight,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence, SlidePanel, ScaleIn, StaggerList, StaggerItem, InteractiveRow, springs, durations, Skeleton } from '@/components/motion'
import { useTaskStore, useUIStore } from '@/stores'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low'

interface TaskDetailData {
  id: string
  taskId: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignees: string[]
  startDate?: string
  dueDate?: string
  description?: string
  tags: string[]
  subtasks: {
    id: string
    title: string
    status: TaskStatus
    assignee?: string
    priority?: TaskPriority
    dueDate?: string
  }[]
  customFields: { name: string; value?: string; icon: string }[]
  activities: {
    id: string
    text: string
    timestamp: string
  }[]
}

const statusOptions = [
  { value: 'todo', label: 'TO DO', group: 'Not started', color: 'text-status-todo' },
  { value: 'in-progress', label: 'IN PROGRESS', group: 'Active', color: 'text-status-in-progress' },
  { value: 'in-review', label: 'IN REVIEW', group: 'Active', color: 'text-status-in-review' },
  { value: 'done', label: 'DONE', group: 'Done', color: 'text-status-done' },
  { value: 'closed', label: 'COMPLETED', group: 'Closed', color: 'text-status-closed' },
]

const priorityOptions = [
  { value: 'urgent', label: 'Urgent', color: 'text-priority-urgent' },
  { value: 'high', label: 'High', color: 'text-priority-high' },
  { value: 'normal', label: 'Normal', color: 'text-priority-normal' },
  { value: 'low', label: 'Low', color: 'text-priority-low' },
]

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  'todo': <Circle className="h-4 w-4 text-status-todo" />,
  'in-progress': <Clock className="h-4 w-4 text-status-in-progress" />,
  'in-review': <GitBranch className="h-4 w-4 text-status-in-review" />,
  'done': <CheckCircle2 className="h-4 w-4 text-status-done" />,
  'closed': <CheckCircle2 className="h-4 w-4 text-status-closed" />,
}

interface TaskDetailProps {
  onClose: () => void
}

export function TaskDetail({ onClose }: TaskDetailProps) {
  const activeTaskId = useUIStore((s) => s.activeTaskId)
  const { taskDetail, isDetailLoading, loadTaskDetail, updateTask, addComment } = useTaskStore()

  useEffect(() => {
    if (activeTaskId) loadTaskDetail(activeTaskId)
  }, [activeTaskId, loadTaskDetail])

  const task = useMemo<TaskDetailData>(() => ({
    id: taskDetail?.id ?? '',
    taskId: taskDetail?.id ?? '',
    title: taskDetail?.title ?? 'Task',
    status: (taskDetail?.status as TaskStatus) ?? 'todo',
    priority: ((taskDetail?.priority as TaskPriority) ?? 'normal'),
    assignees: taskDetail?.assignees ?? [],
    startDate: taskDetail?.startDate ? new Date(taskDetail.startDate).toLocaleDateString() : undefined,
    dueDate: taskDetail?.dueDate ? new Date(taskDetail.dueDate).toLocaleDateString() : undefined,
    description: taskDetail?.description ?? '',
    tags: taskDetail?.tags ?? [],
    subtasks: (taskDetail?.subtasks ?? []).map((st) => ({ id: st.id, title: st.title, status: st.status as TaskStatus })),
    customFields: Object.keys(taskDetail?.customFields ?? {}).map((name) => ({ name, icon: 'grid', value: String((taskDetail?.customFields ?? {})[name] ?? '') })),
    activities: (taskDetail?.comments ?? []).map((c) => ({ id: c.id, text: c.content, timestamp: new Date(c.createdAt).toLocaleString() })),
  }), [taskDetail])
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showEmptyProps, setShowEmptyProps] = useState(true)

  const completedSubtasks = task.subtasks.filter(s => s.status === 'done').length

  if (isDetailLoading) {
    return <div className="fixed inset-0 z-50 p-6"><Skeleton className="h-full w-full" /></div>
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: durations.normal }}
      />

      {/* Modal */}
      <SlidePanel className="relative ml-auto flex h-full w-full max-w-[1200px] bg-background shadow-2xl">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="h-3 w-3 rounded-sm bg-primary" />
                <span>Space</span>
                <span>/</span>
                <span className="font-medium text-foreground">General Project Manager</span>
              </div>
              <Button variant="ghost" size="icon-sm">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Created Apr 23</span>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                Ask AI
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Share2 className="h-3 w-3" />
                Share
              </Button>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Star className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Pin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {/* Task type and ID */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Task
                <ChevronDown className="h-3 w-3" />
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{task.taskId}</span>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Sparkles className="h-3 w-3 text-primary" />
                Ask AI
              </Button>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold mb-1">{task.title}</h1>

            {/* AI prompt */}
            <p className="text-sm text-muted-foreground mb-4">
              <Sparkles className="inline h-3 w-3 mr-1" />
              Ask Brain to write a description, create a summary or find similar tasks
            </p>

            {/* Properties grid */}
            <StaggerList className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
              {/* Status */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5" />
                  Status
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="flex items-center gap-1"
                  >
                    <Badge variant={task.status === 'in-progress' ? 'in-progress' : task.status === 'done' ? 'done' : 'todo'}>
                      {statusOptions.find(s => s.value === task.status)?.label}
                    </Badge>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {showStatusDropdown && (
                      <ScaleIn className="absolute top-full left-0 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-lg z-10">
                        <input
                          className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm mb-1"
                          placeholder="Search..."
                          autoFocus
                        />
                        {['Not started', 'Active', 'Done', 'Closed'].map(group => (
                          <div key={group}>
                            <div className="px-2 py-1 text-2xs font-semibold text-muted-foreground uppercase">
                              {group}
                            </div>
                            {statusOptions.filter(s => s.group === group).map(opt => (
                              <button
                                key={opt.value}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent',
                                  task.status === opt.value && 'bg-accent'
                                )}
                                onClick={() => { setShowStatusDropdown(false); if (task.id) updateTask(task.id, { status: opt.value as TaskStatus }) }}
                              >
                                {statusIcons[opt.value as TaskStatus]}
                                {opt.label}
                                {task.status === opt.value && <span className="ml-auto">✓</span>}
                              </button>
                            ))}
                          </div>
                        ))}
                      </ScaleIn>
                    )}
                  </AnimatePresence>
                </div>
              </StaggerItem>

              {/* Assignees */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Assignees
                </span>
                <span className="text-sm text-muted-foreground">Empty</span>
              </StaggerItem>

              {/* Dates */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Dates
                </span>
                <span className="text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {task.startDate}
                  <span className="text-muted-foreground">→</span>
                  <Calendar className="h-3 w-3" /> {task.dueDate}
                </span>
              </StaggerItem>

              {/* Priority */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5" />
                  Priority
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                    className="flex items-center gap-1 text-sm"
                  >
                    <Flag className={cn('h-3.5 w-3.5', priorityOptions.find(p => p.value === task.priority)?.color)} />
                    {priorityOptions.find(p => p.value === task.priority)?.label}
                  </button>

                  <AnimatePresence>
                    {showPriorityDropdown && (
                      <ScaleIn className="absolute top-full left-0 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg z-10">
                        <div className="px-2 py-1 text-2xs font-semibold text-muted-foreground uppercase">
                          Priority
                        </div>
                        {priorityOptions.map(opt => (
                          <button
                            key={opt.value}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent',
                              task.priority === opt.value && 'bg-accent'
                            )}
                            onClick={() => { setShowPriorityDropdown(false); if (task.id) updateTask(task.id, { priority: opt.value as TaskPriority }) }}
                          >
                            <Flag className={cn('h-3.5 w-3.5', opt.color)} />
                            {opt.label}
                            {task.priority === opt.value && <span className="ml-auto">✓</span>}
                          </button>
                        ))}
                        <div className="border-t border-border mt-1 pt-1">
                          <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            Prioritize with AI
                          </button>
                        </div>
                      </ScaleIn>
                    )}
                  </AnimatePresence>
                </div>
              </StaggerItem>

              {/* Track Time */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Track Time
                </span>
                <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Add time
                </button>
              </StaggerItem>

              {/* Tags */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </span>
                <span className="text-sm text-muted-foreground">Empty</span>
              </StaggerItem>

              {/* Relationships */}
              <StaggerItem className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  Relationships
                </span>
                <span className="text-sm text-muted-foreground">Empty</span>
              </StaggerItem>
            </StaggerList>

            {/* Hide empty properties */}
            <button
              onClick={() => setShowEmptyProps(!showEmptyProps)}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-6 hover:text-foreground"
            >
              {showEmptyProps ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showEmptyProps ? 'Hide' : 'Show'} empty properties
            </button>

            {/* Description */}
            <div className="mb-6">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <FileText className="h-4 w-4" />
                Add description
              </button>
              <button className="flex items-center gap-2 text-sm text-primary mt-1 hover:underline">
                <Sparkles className="h-4 w-4" />
                Write with AI
              </button>
            </div>

            {/* Subtask count */}
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span>{task.subtasks.length}</span>
            </div>

            {/* Custom Fields */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Fields</h3>
              <div className="space-y-2">
                {task.customFields.map((field) => (
                  <div key={field.name} className="flex items-center gap-3 py-1 border-b border-border/50">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      {field.name}
                    </span>
                    <span className="text-sm text-muted-foreground ml-auto">–</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtasks */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold">Subtasks</h3>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-status-done transition-all"
                      style={{ width: `${(completedSubtasks / task.subtasks.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {completedSubtasks}/{task.subtasks.length}
                  </span>
                </div>
              </div>

              {/* Subtask table */}
              <div className="rounded-md border border-border">
                <div className="flex items-center border-b border-border px-3 py-1.5 text-2xs font-medium text-muted-foreground uppercase">
                  <div className="flex-1">Name</div>
                  <div className="w-20 text-center">Assignee</div>
                  <div className="w-16 text-center">Priority</div>
                  <div className="w-20 text-center">Due date</div>
                  <div className="w-8" />
                </div>
                {task.subtasks.map((subtask) => (
                  <InteractiveRow key={subtask.id} className="flex items-center border-b border-border/50 px-3 py-2 cursor-pointer group">
                    <div className="flex items-center gap-2 flex-1">
                      {statusIcons[subtask.status]}
                      <span className="text-sm">{subtask.title}</span>
                    </div>
                    <div className="w-20 flex justify-center">
                      <User className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                    <div className="w-16 flex justify-center">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>
                    <div className="w-20 flex justify-center">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>
                    <div className="w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </InteractiveRow>
                ))}
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </button>
              </div>
            </div>

            {/* Checklists */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">Checklists</h3>
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Create checklist
              </button>
            </div>

            {/* Attachments */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">Attachments</h3>
              <div className="rounded-md border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                Drop your files here to <span className="text-primary underline">upload</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity panel */}
        <div className="w-[380px] flex flex-col border-l border-border bg-background">
          {/* Activity header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h2 className="text-sm font-semibold">Activity</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm">
                <Search className="h-3.5 w-3.5" />
              </Button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-2xs">1</span>
              </span>
              <Button variant="ghost" size="icon-sm">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Activity tab */}
          <div className="border-b border-border px-4">
            <button className="border-b-2 border-primary px-3 py-2 text-xs font-medium text-foreground">
              Activity
            </button>
          </div>

          {/* Activity list */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <StaggerList className="space-y-4">
              {task.activities.map((activity) => (
                <StaggerItem key={activity.id} className="flex gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{activity.text}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">{activity.timestamp}</p>
                  </div>
                </StaggerItem>
              ))}
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-3 w-3" />
                Show more
              </button>
            </StaggerList>
          </div>

          {/* Comment input */}
          <div className="border-t border-border p-3">
            <div className="rounded-md border border-input bg-background">
              <input
                className="w-full px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="Mention @Brain to create, find, ask anything"
              />
              <div className="flex items-center gap-0.5 px-2 py-1 border-t border-border/50">
                {[Plus, Sparkles, SmilePlus, Paperclip, Mic, AtSign, Code, Clipboard, ArrowUpRight].map((Icon, i) => (
                  <motion.button
                    key={i}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    transition={springs.snappy}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </motion.button>
                ))}
                <div className="ml-auto">
                  <Button size="icon-sm" className="rounded-full" onClick={() => task.id && addComment(task.id, "New comment")}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SlidePanel>
    </motion.div>
  )
}
