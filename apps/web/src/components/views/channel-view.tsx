'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Hash,
  Settings,
  Users,
  Pin,
  Bold,
  Italic,
  Code,
  Link2,
  Smile,
  Paperclip,
  AtSign,
  Send,
  MessageSquare,
  ChevronRight,
  X,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  motion,
  AnimatePresence,
  FadeIn,
  StaggerList,
  StaggerItem,
  SlidePanel,
  springs,
} from '@/components/motion'

// Types
interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

interface Message {
  id: string
  author: string
  authorInitial: string
  authorColor: string
  timestamp: string
  content: string
  reactions: Reaction[]
  replyCount?: number
  pinned?: boolean
}

interface ChannelMember {
  id: string
  name: string
  initial: string
  color: string
  status: 'online' | 'away' | 'offline'
}

interface PinnedMessage {
  id: string
  author: string
  content: string
  pinnedAt: string
}

// Demo data
const demoMessages: Message[] = [
  {
    id: 'm1',
    author: 'Shashank',
    authorInitial: 'S',
    authorColor: 'bg-primary',
    timestamp: '9:15 AM',
    content: 'Good morning team! I just pushed the latest API changes to the staging branch. Can someone review the PR when they get a chance?',
    reactions: [
      { emoji: '👍', count: 3, reacted: true },
      { emoji: '👀', count: 1, reacted: false },
    ],
    replyCount: 3,
  },
  {
    id: 'm2',
    author: 'Alex',
    authorInitial: 'A',
    authorColor: 'bg-green-500',
    timestamp: '9:22 AM',
    content: 'On it! I\'ll take a look after standup. By the way, the new **authentication flow** looks great in the demo.',
    reactions: [
      { emoji: '🎉', count: 2, reacted: false },
    ],
  },
  {
    id: 'm3',
    author: 'Jordan',
    authorInitial: 'J',
    authorColor: 'bg-purple-500',
    timestamp: '9:30 AM',
    content: 'Quick heads up: the `redis` connection pool config needs to be updated for production. I\'ll create a task for it.',
    reactions: [],
    replyCount: 1,
  },
  {
    id: 'm4',
    author: 'Taylor',
    authorInitial: 'T',
    authorColor: 'bg-orange-500',
    timestamp: '9:45 AM',
    content: 'The design review for the dashboard widgets is scheduled for 2 PM today. Make sure to check the Figma link I shared yesterday.',
    reactions: [
      { emoji: '✅', count: 4, reacted: true },
    ],
    pinned: true,
  },
  {
    id: 'm5',
    author: 'Morgan',
    authorInitial: 'M',
    authorColor: 'bg-pink-500',
    timestamp: '10:03 AM',
    content: 'I finished the sprint burndown chart component. Here\'s a summary of what\'s included:\n\n- Actual vs ideal burndown lines\n- Story point tracking\n- Velocity indicators\n- Responsive layout support',
    reactions: [
      { emoji: '🔥', count: 3, reacted: false },
      { emoji: '💯', count: 2, reacted: true },
    ],
    replyCount: 5,
  },
  {
    id: 'm6',
    author: 'Alex',
    authorInitial: 'A',
    authorColor: 'bg-green-500',
    timestamp: '10:15 AM',
    content: 'PR reviewed and approved. Nice work on the error handling! One small suggestion: we might want to add rate limiting on the webhook endpoints.',
    reactions: [
      { emoji: '👍', count: 2, reacted: false },
    ],
  },
  {
    id: 'm7',
    author: 'Shashank',
    authorInitial: 'S',
    authorColor: 'bg-primary',
    timestamp: '10:28 AM',
    content: 'Great catch! I\'ll add that to the next sprint. Thanks for the thorough review everyone.',
    reactions: [
      { emoji: '🙏', count: 1, reacted: false },
      { emoji: '❤️', count: 2, reacted: true },
    ],
  },
]

const demoMembers: ChannelMember[] = [
  { id: 'u1', name: 'Shashank', initial: 'S', color: 'bg-primary', status: 'online' },
  { id: 'u2', name: 'Alex', initial: 'A', color: 'bg-green-500', status: 'online' },
  { id: 'u3', name: 'Jordan', initial: 'J', color: 'bg-purple-500', status: 'away' },
  { id: 'u4', name: 'Taylor', initial: 'T', color: 'bg-orange-500', status: 'online' },
  { id: 'u5', name: 'Morgan', initial: 'M', color: 'bg-pink-500', status: 'offline' },
]

const demoPinnedMessages: PinnedMessage[] = [
  {
    id: 'p1',
    author: 'Taylor',
    content: 'Design review for dashboard widgets is scheduled for 2 PM today.',
    pinnedAt: 'Apr 26, 2026',
  },
  {
    id: 'p2',
    author: 'Shashank',
    content: 'Sprint 12 goals and key deliverables are pinned in the #goals channel.',
    pinnedAt: 'Apr 24, 2026',
  },
]

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-400',
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className="group flex gap-3 px-5 py-2 hover:bg-accent/30 transition-colors">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className={cn('text-xs', message.authorColor)}>
          {message.authorInitial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{message.author}</span>
          <span className="text-2xs text-muted-foreground">{message.timestamp}</span>
          {message.pinned && (
            <Pin className="h-3 w-3 text-yellow-500" />
          )}
        </div>
        <div className="text-sm text-foreground/90 leading-relaxed mt-0.5 whitespace-pre-line">
          {message.content.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i}>{part.slice(2, -2)}</strong>
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                  {part.slice(1, -1)}
                </code>
              )
            }
            return part
          })}
        </div>

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            {message.reactions.map((reaction, i) => (
              <button
                key={i}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  reaction.reacted
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <Smile className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Thread reply indicator */}
        {message.replyCount && message.replyCount > 0 && (
          <button className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline">
            <MessageSquare className="h-3 w-3" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function ChannelSidebar({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'details' | 'members' | 'pinned'>('details')

  return (
    <SlidePanel className="w-72 border-l border-border bg-background flex flex-col shrink-0">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Channel Details</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2">
        {(['details', 'members', 'pinned'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-xs font-medium capitalize transition-colors border-b-2',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-2xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Channel Name</h4>
              <p className="text-sm"># general</p>
            </div>
            <div>
              <h4 className="text-2xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Topic</h4>
              <p className="text-xs text-muted-foreground">General discussion for the team. Share updates, ask questions, and stay connected.</p>
            </div>
            <div>
              <h4 className="text-2xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Created</h4>
              <p className="text-xs text-muted-foreground">Apr 1, 2026</p>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-1">
            {demoMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="relative">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={cn('text-[10px]', member.color)}>{member.initial}</AvatarFallback>
                  </Avatar>
                  <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background', statusColors[member.status])} />
                </div>
                <span className="text-sm">{member.name}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pinned' && (
          <div className="space-y-3">
            {demoPinnedMessages.map((msg) => (
              <div key={msg.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Pin className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs font-medium">{msg.author}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{msg.content}</p>
                <p className="text-2xs text-muted-foreground mt-1.5">{msg.pinnedAt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

export function ChannelView({ channelId }: { channelId: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Channel header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="h-4.5 w-4.5 text-muted-foreground" />
          <h1 className="text-sm font-semibold">general</h1>
          <span className="text-2xs text-muted-foreground">|</span>
          <span className="text-2xs text-muted-foreground">{demoMembers.length} members</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn('text-muted-foreground', sidebarOpen && 'bg-accent text-foreground')}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin py-4">
            <StaggerList>
              {demoMessages.map((message) => (
                <StaggerItem key={message.id}>
                  <MessageBubble message={message} />
                </StaggerItem>
              ))}
            </StaggerList>
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="border-t border-border px-5 py-3 shrink-0">
            <div className="rounded-lg border border-border bg-background">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 border-b border-border/50 px-3 py-1.5">
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Code className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Smile className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <AtSign className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Text area */}
              <div className="flex items-end gap-2 px-3 py-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Message #general"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px]"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                    messageText.trim()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <AnimatePresence>
          {sidebarOpen && <ChannelSidebar onClose={() => setSidebarOpen(false)} />}
        </AnimatePresence>
      </div>
    </div>
  )
}
