'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Users, Settings, MoreHorizontal, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerList, StaggerItem, InteractiveCard } from '@/components/motion'

interface TeamMember {
  id: string
  name: string
  initials: string
  role: string
}

interface Team {
  id: string
  name: string
  description: string
  members: TeamMember[]
  color: string
}

const demoTeams: Team[] = [
  {
    id: '1',
    name: 'Engineering',
    description: 'Core product development and infrastructure',
    members: [
      { id: 'm1', name: 'Shashank Saxena', initials: 'SS', role: 'Lead' },
      { id: 'm2', name: 'Alex Chen', initials: 'AC', role: 'Senior' },
      { id: 'm3', name: 'Maria Garcia', initials: 'MG', role: 'Senior' },
      { id: 'm4', name: 'James Wilson', initials: 'JW', role: 'Mid' },
      { id: 'm5', name: 'Sarah Park', initials: 'SP', role: 'Mid' },
      { id: 'm6', name: 'Raj Patel', initials: 'RP', role: 'Junior' },
      { id: 'm7', name: 'Lisa Wang', initials: 'LW', role: 'Junior' },
    ],
    color: 'bg-blue-500',
  },
  {
    id: '2',
    name: 'Design',
    description: 'UI/UX design, branding, and visual identity',
    members: [
      { id: 'm8', name: 'Emma Thompson', initials: 'ET', role: 'Lead' },
      { id: 'm9', name: 'David Kim', initials: 'DK', role: 'Senior' },
      { id: 'm10', name: 'Nina Vasquez', initials: 'NV', role: 'Mid' },
    ],
    color: 'bg-purple-500',
  },
  {
    id: '3',
    name: 'Product',
    description: 'Product strategy, roadmap, and customer research',
    members: [
      { id: 'm11', name: 'Michael Brown', initials: 'MB', role: 'Lead' },
      { id: 'm12', name: 'Kate Johnson', initials: 'KJ', role: 'Senior' },
      { id: 'm13', name: 'Tom Lee', initials: 'TL', role: 'Mid' },
      { id: 'm14', name: 'Anna White', initials: 'AW', role: 'Mid' },
    ],
    color: 'bg-green-500',
  },
  {
    id: '4',
    name: 'Marketing',
    description: 'Growth, content, and go-to-market strategy',
    members: [
      { id: 'm15', name: 'Chris Davis', initials: 'CD', role: 'Lead' },
      { id: 'm16', name: 'Rachel Green', initials: 'RG', role: 'Senior' },
    ],
    color: 'bg-orange-500',
  },
  {
    id: '5',
    name: 'QA',
    description: 'Quality assurance and testing automation',
    members: [
      { id: 'm17', name: 'Oscar Martinez', initials: 'OM', role: 'Lead' },
      { id: 'm18', name: 'Yuki Tanaka', initials: 'YT', role: 'Senior' },
      { id: 'm19', name: 'Ben Nguyen', initials: 'BN', role: 'Mid' },
    ],
    color: 'bg-red-500',
  },
]

export function TeamsView() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTeams = demoTeams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Teams</h1>
            <Badge variant="secondary">{demoTeams.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams..."
                className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Create Team
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Content */}
      <div className="p-6">
        {filteredTeams.length === 0 ? (
          <FadeIn className="flex flex-col items-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {searchQuery ? 'No teams found' : 'Create your first team'}
            </h3>
            <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
              {searchQuery
                ? 'Try a different search term.'
                : 'Teams help you organize people and manage permissions across your workspace.'}
            </p>
            {!searchQuery && (
              <Button className="gap-1">
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            )}
          </FadeIn>
        ) : (
          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map((team) => (
              <StaggerItem key={team.id}>
                <TeamCard team={team} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  )
}

function TeamCard({ team }: { team: Team }) {
  const displayMembers = team.members.slice(0, 5)
  const overflowCount = team.members.length - displayMembers.length

  return (
    <InteractiveCard className="rounded-lg border border-border p-4 cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm', team.color)}>
            {team.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{team.name}</h3>
            <p className="text-xs text-muted-foreground">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <p className="mb-4 text-xs text-muted-foreground line-clamp-2">
        {team.description}
      </p>

      {/* Member avatars */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {displayMembers.map((member) => (
            <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
              <AvatarFallback className="text-2xs">{member.initials}</AvatarFallback>
            </Avatar>
          ))}
          {overflowCount > 0 && (
            <Avatar className="h-7 w-7 border-2 border-card">
              <AvatarFallback className="bg-muted text-2xs text-muted-foreground">
                +{overflowCount}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <Button variant="outline" size="sm" className="text-xs">
          View Team
        </Button>
      </div>
    </InteractiveCard>
  )
}
