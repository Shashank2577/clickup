'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ChevronRight,
  Share2,
  MoreHorizontal,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  List,
  ListOrdered,
  Quote,
  Minus,
  FileText,
  X,
  Download,
  History,
  Trash2,
  ListTree as TableOfContents,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  AnimatePresence,
  FadeIn,
  SlidePanel,
  springs,
} from '@/components/motion'

// Types
interface TocItem {
  id: string
  level: number
  text: string
}

interface Comment {
  id: string
  author: string
  authorInitial: string
  authorColor: string
  content: string
  timestamp: string
  resolved: boolean
}

// Demo data
const demoToc: TocItem[] = [
  { id: 'h1', level: 1, text: 'Project Overview' },
  { id: 'h2', level: 2, text: 'Goals & Objectives' },
  { id: 'h3', level: 2, text: 'Timeline' },
  { id: 'h4', level: 1, text: 'Technical Architecture' },
  { id: 'h5', level: 2, text: 'System Design' },
  { id: 'h6', level: 2, text: 'API Specifications' },
  { id: 'h7', level: 1, text: 'Team & Responsibilities' },
  { id: 'h8', level: 1, text: 'Next Steps' },
]

const demoComments: Comment[] = [
  {
    id: 'c1',
    author: 'Alex',
    authorInitial: 'A',
    authorColor: 'bg-green-500',
    content: 'Should we add a section on deployment strategy here?',
    timestamp: '2 hours ago',
    resolved: false,
  },
  {
    id: 'c2',
    author: 'Jordan',
    authorInitial: 'J',
    authorColor: 'bg-purple-500',
    content: 'The timeline looks aggressive. Can we add buffer days for QA?',
    timestamp: '5 hours ago',
    resolved: false,
  },
  {
    id: 'c3',
    author: 'Shashank',
    authorInitial: 'S',
    authorColor: 'bg-primary',
    content: 'Updated the API specs to include the new webhook endpoints.',
    timestamp: 'Yesterday',
    resolved: true,
  },
]

const demoContent = `# Project Overview

This document outlines the technical plan and architecture for the **ClickUp Clone** project. The goal is to build a modern, performant project management platform that rivals industry-leading tools.

## Goals & Objectives

The primary objectives for this project are:

- **Build a full-featured project management UI** with spaces, lists, tasks, and views
- **Implement real-time collaboration** features including chat channels and document editing
- **Design an extensible architecture** that supports custom dashboards and widgets
- **Deliver a polished user experience** with animations, keyboard shortcuts, and responsive design

Our target is to complete the MVP within 8 weeks, with alpha testing beginning in week 6.

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| Phase 1 | Weeks 1-2 | Core UI shell, navigation, task views |
| Phase 2 | Weeks 3-4 | Board view, documents, dashboards |
| Phase 3 | Weeks 5-6 | Chat, goals, whiteboards |
| Phase 4 | Weeks 7-8 | Polish, testing, deployment |

# Technical Architecture

The application follows a microservices architecture with a Next.js frontend and independent backend services.

## System Design

The frontend is built with **Next.js 14 App Router** using TypeScript, Tailwind CSS, and Framer Motion. State management uses Zustand stores for client-side state, with the API client handling server communication.

Key architectural decisions:

1. **App Router** for file-based routing and server components where applicable
2. **Zustand** for lightweight, performant client state management
3. **Framer Motion** for consistent, fluid animations throughout the UI
4. **Radix UI** primitives for accessible, unstyled component foundations

## API Specifications

All API endpoints follow RESTful conventions with consistent error handling:

\`\`\`
GET    /api/v1/spaces          - List all spaces
POST   /api/v1/spaces          - Create a new space
GET    /api/v1/spaces/:id      - Get space details
PATCH  /api/v1/spaces/:id      - Update a space
DELETE /api/v1/spaces/:id      - Delete a space
\`\`\`

# Team & Responsibilities

- **Shashank** - Tech Lead, Architecture, Backend Services
- **Alex** - Frontend Development, UI Components
- **Jordan** - DevOps, CI/CD, Infrastructure
- **Taylor** - Design, UX Research, Prototyping
- **Morgan** - QA, Testing, Documentation

# Next Steps

1. Finalize the database schema for the task management service
2. Set up the CI/CD pipeline with automated testing
3. Begin implementation of the real-time WebSocket layer
4. Schedule the first design review session with stakeholders`

function ToolbarButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function EditorSidebar({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'toc' | 'comments'>('toc')

  return (
    <SlidePanel className="w-72 border-l border-border bg-background flex flex-col shrink-0">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Document</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2">
        <button
          onClick={() => setActiveTab('toc')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2',
            activeTab === 'toc'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <TableOfContents className="h-3 w-3" />
          Contents
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2',
            activeTab === 'comments'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-3 w-3" />
          Comments
          <span className="rounded-full bg-primary/10 px-1.5 py-0 text-2xs text-primary font-semibold">
            {demoComments.filter((c) => !c.resolved).length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'toc' && (
          <div className="space-y-0.5">
            {demoToc.map((item) => (
              <button
                key={item.id}
                className={cn(
                  'w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors truncate',
                  item.level === 1 ? 'font-medium text-foreground' : 'text-muted-foreground pl-5'
                )}
              >
                {item.text}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-3">
            {demoComments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  'rounded-lg border p-3',
                  comment.resolved ? 'border-border/50 opacity-60' : 'border-border'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className={cn('text-[9px]', comment.authorColor)}>
                      {comment.authorInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{comment.author}</span>
                  <span className="text-2xs text-muted-foreground">{comment.timestamp}</span>
                  {comment.resolved && (
                    <span className="text-2xs text-green-500 font-medium">Resolved</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

function DropdownMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={springs.snappy}
        className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md"
      >
        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
          <Download className="h-4 w-4 text-muted-foreground" />
          Export
        </button>
        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
          <History className="h-4 w-4 text-muted-foreground" />
          Version history
        </button>
        <div className="my-1 h-px bg-border" />
        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </motion.div>
    </>
  )
}

export function DocEditor({ docId }: { docId: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [title, setTitle] = useState('ClickUp Clone - Technical Plan')

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <span>General Project Manager</span>
            <ChevronRight className="h-3 w-3" />
            <span>Sprint 12</span>
            <ChevronRight className="h-3 w-3" />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-0 min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 text-2xs text-muted-foreground mr-2">
            <Clock className="h-3 w-3" />
            <span>Saved 2 min ago</span>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <Share2 className="h-3 w-3" />
            Share
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon-sm" onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              <DropdownMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
            </AnimatePresence>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(sidebarOpen && 'bg-accent')}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <TableOfContents className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-5 py-1 shrink-0">
        <ToolbarButton><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Heading3 className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Underline className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Strikethrough className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton><Code className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Link2 className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton><List className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Quote className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton><Minus className="h-3.5 w-3.5" /></ToolbarButton>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <FadeIn className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-8 py-8">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              {demoContent.split('\n').map((line, i) => {
                if (line.startsWith('# ')) {
                  return <h1 key={i} className="text-2xl font-bold mt-8 mb-4 first:mt-0">{line.slice(2)}</h1>
                }
                if (line.startsWith('## ')) {
                  return <h2 key={i} className="text-lg font-semibold mt-6 mb-3">{line.slice(3)}</h2>
                }
                if (line.startsWith('- **')) {
                  const match = line.match(/^- \*\*(.*?)\*\*(.*)$/)
                  if (match) {
                    return (
                      <div key={i} className="flex items-start gap-2 py-1 pl-2">
                        <span className="text-muted-foreground mt-1.5">&#8226;</span>
                        <span className="text-sm leading-relaxed">
                          <strong>{match[1]}</strong>{match[2]}
                        </span>
                      </div>
                    )
                  }
                }
                if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ')) {
                  const num = line.charAt(0)
                  return (
                    <div key={i} className="flex items-start gap-2 py-1 pl-2">
                      <span className="text-muted-foreground font-medium text-sm">{num}.</span>
                      <span className="text-sm leading-relaxed">{line.slice(3).replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                    </div>
                  )
                }
                if (line.startsWith('| ') && line.includes('|')) {
                  if (line.includes('---')) return null
                  const cells = line.split('|').filter(Boolean).map((c) => c.trim())
                  const isHeader = i > 0 && demoContent.split('\n')[i + 1]?.includes('---')
                  return (
                    <div key={i} className={cn('grid grid-cols-3 gap-4 py-2 px-2 text-xs border-b border-border/50', isHeader && 'font-medium text-muted-foreground')}>
                      {cells.map((cell, j) => (
                        <span key={j}>{cell}</span>
                      ))}
                    </div>
                  )
                }
                if (line.startsWith('```')) {
                  return null
                }
                if (line.startsWith('GET') || line.startsWith('POST') || line.startsWith('PATCH') || line.startsWith('DELETE')) {
                  return (
                    <div key={i} className="font-mono text-xs bg-muted/50 px-3 py-1 rounded">
                      {line}
                    </div>
                  )
                }
                if (line.trim() === '') {
                  return <div key={i} className="h-3" />
                }
                return (
                  <p key={i} className="text-sm text-foreground/85 leading-relaxed my-2">
                    {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>
                      }
                      return part
                    })}
                  </p>
                )
              })}
            </article>
          </div>
        </FadeIn>

        {/* Right sidebar */}
        <AnimatePresence>
          {sidebarOpen && <EditorSidebar onClose={() => setSidebarOpen(false)} />}
        </AnimatePresence>
      </div>
    </div>
  )
}
