'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Target,
  Plus,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react'
import { motion, FadeIn, InteractiveCard, Skeleton } from '@/components/motion'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores'

// === WIRING: fallback demo goals when API returns empty ===
const demoGoals = [
  { id: 'demo-1', title: 'Launch v2.0 by end of quarter', description: 'Ship all planned features for the 2.0 release' },
  { id: 'demo-2', title: 'Improve test coverage to 80%', description: 'Increase unit and integration test coverage across all services' },
]

export function GoalsView() {
  // === WIRING: get workspaceId from auth store ===
  const workspace = useAuthStore((s) => s.workspace)
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // === WIRING: fetch goals from API on mount ===
  useEffect(() => {
    async function load() {
      if (!workspace?.id) return
      setLoading(true)
      try {
        const data = await api.get<any[]>(`/goals/workspace/${workspace.id}`)
        setGoals(data)
      } catch {
        setGoals([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspace?.id])

  // === WIRING: create new goal via API, then refresh list ===
  async function createGoal() {
    if (!workspace?.id) return
    try {
      await api.post('/goals', {
        body: { workspaceId: workspace.id, title: 'New Goal' },
      })
      const refreshed = await api.get<any[]>(`/goals/workspace/${workspace.id}`)
      setGoals(refreshed)
    } catch {
      // Silently fail
    }
  }

  // === WIRING: create new goal folder via API ===
  async function createFolder() {
    if (!workspace?.id) return
    try {
      await api.post(`/goals/workspace/${workspace.id}/goal-folders`, {
        body: { name: 'New Folder' },
      })
    } catch {
      // Silently fail
    }
  }

  // Use demo data as fallback when no goals exist
  const displayGoals = goals.length > 0 ? goals : []

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Goals</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            onClick={createFolder}
          >
            <FolderOpen className="h-3 w-3" />
            New Folder
          </Button>
          <Button size="sm" className="gap-1" onClick={createGoal}>
            <Plus className="h-3 w-3" />
            Set a Goal
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-6 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : displayGoals.length === 0 ? (
        /* Empty state with floating illustration */
        <FadeIn className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-center max-w-lg px-6">
            {/* Floating animation */}
            <motion.div
              className="relative mb-8"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Target className="h-10 w-10 text-primary" />
                </div>
              </div>
            </motion.div>

            <h2 className="text-2xl font-bold mb-3">
              Make your goals a reality.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Track your progress toward important objectives.
            </p>

            <div className="flex items-center gap-3">
              <Button className="gap-2" onClick={createGoal}>
                <Plus className="h-4 w-4" />
                Set a Goal
              </Button>
              <Button
                variant="link"
                className="text-sm gap-1 text-muted-foreground hover:text-foreground"
              >
                Learn more
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Feature cards */}
            <div className="mt-12 grid grid-cols-3 gap-6 w-full">
              <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <h4 className="text-xs font-semibold mb-1">Set Targets</h4>
              </InteractiveCard>
              <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <h4 className="text-xs font-semibold mb-1">Track Progress</h4>
              </InteractiveCard>
              <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                </div>
                <h4 className="text-xs font-semibold mb-1">Achieve Results</h4>
              </InteractiveCard>
            </div>
          </div>
        </FadeIn>
      ) : (
        /* Goal list */
        <div className="p-6 space-y-2">
          {displayGoals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{goal.title}</h3>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {goal.description ?? 'No description'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
