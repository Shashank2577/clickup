'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  MonitorPlay,
  Video,
  Mic,
  Users,
  Sparkles,
  Plus,
  Search,
  Camera,
  Share2,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface SidebarNavItem {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
}

interface FeatureCard {
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

// --- Data ---

const sidebarItems: SidebarNavItem[] = [
  { id: 'all', label: 'All Clips', icon: <MonitorPlay className="h-4 w-4" />, count: 0 },
  { id: 'video', label: 'Video Clips', icon: <Video className="h-4 w-4" />, count: 0 },
  { id: 'voice', label: 'Voice Clips', icon: <Mic className="h-4 w-4" />, count: 0 },
  { id: 'syncups', label: 'SyncUps', icon: <Users className="h-4 w-4" />, count: 0 },
  { id: 'ai-notetaker', label: 'AI Notetaker', icon: <Sparkles className="h-4 w-4" />, count: 0 },
]

const featureCards: FeatureCard[] = [
  {
    title: 'Record your screen',
    description: 'Capture your screen, camera, or both to create video clips. Share feedback, report bugs, or walk through features.',
    icon: <Camera className="h-6 w-6" />,
    color: '#7B68EE',
  },
  {
    title: 'Share instantly',
    description: 'Get a shareable link the moment you stop recording. Drop it in tasks, chats, or docs for easy collaboration.',
    icon: <Share2 className="h-6 w-6" />,
    color: '#3B82F6',
  },
  {
    title: 'Comment & react',
    description: 'Add timestamped comments and reactions to clips. Have threaded discussions without scheduling a meeting.',
    icon: <MessageSquare className="h-6 w-6" />,
    color: '#22C55E',
  },
]

// --- Components ---

function ClipsSidebar({
  activeItem,
  onItemChange,
}: {
  activeItem: string
  onItemChange: (id: string) => void
}) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-sidebar overflow-y-auto scrollbar-thin">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Clips</h2>
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

function WelcomeFeatureCard({ card }: { card: FeatureCard }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card p-5 text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: card.color }}
      >
        {card.icon}
      </div>
      <h4 className="text-sm font-medium mb-1.5">{card.title}</h4>
      <p className="text-2xs text-muted-foreground leading-relaxed">
        {card.description}
      </p>
    </div>
  )
}

// --- Main Component ---

export function ClipsHub() {
  const [activeItem, setActiveItem] = useState('all')

  return (
    <div className="flex h-full">
      <ClipsSidebar activeItem={activeItem} onItemChange={setActiveItem} />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <h1 className="text-lg font-semibold">Clips</h1>
          <div className="flex items-center gap-2">
            <div className="flex h-7 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search clips...</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              Sort by
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold mb-1">Welcome to Clips</h2>
              <p className="text-sm text-muted-foreground">
                Record, share, and collaborate with video and voice clips
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {featureCards.map((card) => (
                <WelcomeFeatureCard key={card.title} card={card} />
              ))}
            </div>
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <MonitorPlay className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium mb-1">Create your first Clip!</h3>
            <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
              Record your screen or voice to share quick updates, feedback, or walkthroughs with your team
            </p>
            <Button size="sm" className="gap-1">
              <Video className="h-3.5 w-3.5" />
              Create Clip
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
