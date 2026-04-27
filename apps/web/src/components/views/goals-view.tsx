'use client'

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
import { cn } from '@/lib/utils'
import { motion, FadeIn, InteractiveCard } from '@/components/motion'

export function GoalsView() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold">Goals</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <FolderOpen className="h-3 w-3" />
            New Folder
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="h-3 w-3" />
            Set a Goal
          </Button>
        </div>
      </div>

      {/* Empty state */}
      <FadeIn className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center text-center max-w-lg px-6">
          {/* Illustration placeholder */}
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
            {/* Decorative orbiting dots */}
            <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="absolute bottom-2 left-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="absolute top-0 left-4 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10">
              <CheckCircle2 className="h-3 w-3 text-blue-500" />
            </div>
          </motion.div>

          <h2 className="text-2xl font-bold mb-3">Make your goals a reality.</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Track your progress toward important objectives. Set measurable targets,
            break them into smaller key results, and connect goals to the tasks
            and projects that drive them forward. Align your team around what matters most.
          </p>

          <div className="flex items-center gap-3">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Set a Goal
            </Button>
            <Button variant="link" className="text-sm gap-1 text-muted-foreground hover:text-foreground">
              Learn more
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="mt-12 grid grid-cols-3 gap-6 w-full">
            <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h4 className="text-xs font-semibold mb-1">Set Targets</h4>
              <p className="text-2xs text-muted-foreground">
                Define measurable objectives with clear deadlines
              </p>
            </InteractiveCard>
            <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 mb-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <h4 className="text-xs font-semibold mb-1">Track Progress</h4>
              <p className="text-2xs text-muted-foreground">
                See real-time progress from linked tasks and key results
              </p>
            </InteractiveCard>
            <InteractiveCard className="flex flex-col items-center text-center cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
              <h4 className="text-xs font-semibold mb-1">Achieve Results</h4>
              <p className="text-2xs text-muted-foreground">
                Align your team and celebrate milestones together
              </p>
            </InteractiveCard>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
