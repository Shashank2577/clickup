'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Settings,
  Filter,
  Tag,
  DollarSign,
  LayoutList,
  Table,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, TabContent, FadeIn, springs } from '@/components/motion'

// --- Types ---

interface TimeEntry {
  id: string
  taskName: string
  location: string
  daily: number[] // Sun-Sat, 7 entries in hours
}

// --- Demo Data ---

const demoEntries: TimeEntry[] = []

const topTabs = [
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'my-timesheet', label: 'My timesheet' },
  { id: 'all-timesheets', label: 'All timesheets' },
  { id: 'approvals', label: 'Approvals' },
]

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDates(offset: number): { start: Date; end: Date; dates: Date[] } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek + offset * 7)
  startOfWeek.setHours(0, 0, 0, 0)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    dates.push(d)
  }

  const end = new Date(startOfWeek)
  end.setDate(startOfWeek.getDate() + 6)

  return { start: startOfWeek, end, dates }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} - ${endStr}`
}

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// --- Components ---

function FilterPills() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1 text-xs">
        <DollarSign className="h-3 w-3" />
        Billable status
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>
      <Button variant="outline" size="sm" className="gap-1 text-xs">
        <Tag className="h-3 w-3" />
        Tag
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>
      <Button variant="outline" size="sm" className="gap-1 text-xs">
        <Clock className="h-3 w-3" />
        Tracked time
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  )
}

function ViewToggle({ activeView, onViewChange }: { activeView: string; onViewChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-md border border-input bg-background">
      <button
        onClick={() => onViewChange('timesheet')}
        className={cn(
          'flex items-center gap-1 rounded-l-md px-2.5 py-1 text-xs font-medium transition-colors',
          activeView === 'timesheet'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Table className="h-3 w-3" />
        Timesheet view
      </button>
      <button
        onClick={() => onViewChange('entries')}
        className={cn(
          'flex items-center gap-1 rounded-r-md px-2.5 py-1 text-xs font-medium transition-colors',
          activeView === 'entries'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <LayoutList className="h-3 w-3" />
        Time entries view
      </button>
    </div>
  )
}

function TimesheetGrid({ entries, dates }: { entries: TimeEntry[]; dates: Date[] }) {
  const totals = Array(7).fill(0)
  entries.forEach((entry) => {
    entry.daily.forEach((val, i) => {
      totals[i] += val
    })
  })
  const grandTotal = totals.reduce((a, b) => a + b, 0)

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-background px-4 py-2 text-left text-2xs font-medium uppercase tracking-wider text-muted-foreground min-w-[240px]">
              Task / Location
            </th>
            {dates.map((d, i) => (
              <th
                key={i}
                className={cn(
                  'px-3 py-2 text-center text-2xs font-medium uppercase tracking-wider min-w-[80px]',
                  isToday(d)
                    ? 'bg-primary/5 text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <div>{dayLabels[i]}</div>
                <div className="text-xs font-normal mt-0.5">{d.getDate()}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground min-w-[80px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.length > 0 ? (
            <>
              {entries.map((entry) => {
                const rowTotal = entry.daily.reduce((a, b) => a + b, 0)
                return (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-background px-4 py-2">
                      <div className="text-sm font-medium truncate">{entry.taskName}</div>
                      <div className="text-2xs text-muted-foreground truncate">{entry.location}</div>
                    </td>
                    {entry.daily.map((val, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-3 py-2 text-center text-sm tabular-nums',
                          isToday(dates[i]) && 'bg-primary/5',
                          val === 0 ? 'text-muted-foreground/40' : 'text-foreground'
                        )}
                      >
                        {val}h
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-sm font-medium tabular-nums">
                      {rowTotal}h
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2 text-sm font-semibold">
                  Total
                </td>
                {totals.map((t, i) => (
                  <td
                    key={i}
                    className={cn(
                      'px-3 py-2 text-center text-sm font-semibold tabular-nums',
                      isToday(dates[i]) && 'bg-primary/5'
                    )}
                  >
                    {t}h
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-sm font-bold tabular-nums">
                  {grandTotal}h
                </td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan={9}>
                {/* Empty state */}
                <FadeIn delay={0.15}>
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      No time entries for this week
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Track time on tasks to see entries here
                    </p>
                    <Button size="sm" className="gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Track time
                    </Button>
                  </div>
                </FadeIn>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// --- Main Component ---

export function TimesheetsView() {
  const [activeTab, setActiveTab] = useState('my-timesheet')
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState('timesheet')

  const { start, end, dates } = getWeekDates(weekOffset)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">Timesheets</h1>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <Settings className="h-3.5 w-3.5" />
          Configure
        </Button>
      </div>

      {/* Top tabs */}
      <div className="flex items-center gap-4 border-b border-border px-6">
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative py-2.5 text-sm font-medium transition-colors border-b-2 border-transparent',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTimesheetTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={springs.snappy}
              />
            )}
          </button>
        ))}
      </div>

      {/* Week navigator + filters + view toggle */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex items-center gap-3">
          {/* Week navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              className="rounded-md px-3 py-1 text-sm font-medium hover:bg-accent transition-colors"
              onClick={() => setWeekOffset(0)}
            >
              {formatDateRange(start, end)}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={() => setWeekOffset(0)}
              >
                Today
              </Button>
            )}
          </div>

          {/* Filter pills */}
          <div className="border-l border-border pl-3">
            <FilterPills />
          </div>
        </div>

        {/* View toggle */}
        <ViewToggle activeView={viewMode} onViewChange={setViewMode} />
      </div>

      {/* Grid */}
      <TimesheetGrid entries={demoEntries} dates={dates} />

      {/* Footer */}
      <div className="border-t border-border px-6 py-2">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add task
        </button>
      </div>
    </div>
  )
}
