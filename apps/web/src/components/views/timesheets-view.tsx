'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Clock, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, springs, FadeIn, Skeleton } from '@/components/motion'
import { api } from '@/lib/api-client'

interface TimeEntry { id: string; taskName: string; location: string; daily: number[] }

const topTabs = [
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'my-timesheet', label: 'My timesheet' },
  { id: 'all-timesheets', label: 'All timesheets' },
  { id: 'approvals', label: 'Approvals' },
]
const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getWeekDates(offset:number){const now=new Date();const day=now.getDay();const start=new Date(now);start.setDate(now.getDate()-day+offset*7);start.setHours(0,0,0,0);const dates=[...Array(7)].map((_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});const end=new Date(start);end.setDate(start.getDate()+6);return {start,end,dates}}
const formatDateRange=(s:Date,e:Date)=>`${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${e.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`

export function TimesheetsView() {
  const [activeTab, setActiveTab] = useState('my-timesheet')
  const [weekOffset, setWeekOffset] = useState(0)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const { start, end, dates } = getWeekDates(weekOffset)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await api.get<any[]>('/tasks/time-entries/timesheet', { params: { userId: activeTab === 'all-timesheets' ? undefined : 'me', weekStart: start.toISOString().slice(0,10) } })
        setEntries(data.map((e) => ({ id: e.id, taskName: e.taskName, location: e.location, daily: e.daily ?? [0,0,0,0,0,0,0] })))
      } catch { setEntries([]) } finally { setLoading(false) }
    }
    load()
  }, [activeTab, start])

  const totals = Array(7).fill(0); entries.forEach((e)=>e.daily.forEach((v,i)=>totals[i]+=v)); const grandTotal = totals.reduce((a,b)=>a+b,0)

  return <div className="flex h-full flex-col"><div className="flex items-center justify-between border-b border-border px-6 py-3"><h1 className="text-lg font-semibold">Timesheets</h1><Button variant="outline" size="sm" className="gap-1 text-xs"><Settings className="h-3.5 w-3.5" />Configure</Button></div>
    <div className="flex items-center gap-4 border-b border-border px-6">{topTabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('relative py-2.5 text-sm font-medium transition-colors border-b-2 border-transparent', activeTab === tab.id ? 'text-foreground':'text-muted-foreground hover:text-foreground')}>{tab.label}{activeTab===tab.id && <motion.div layoutId="activeTimesheetTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" transition={springs.snappy} />}</button>)}</div>
    <div className="flex items-center justify-between border-b border-border px-6 py-2"><div className="flex items-center gap-1"><Button variant='ghost' size='icon-sm' onClick={()=>setWeekOffset((o)=>o-1)}><ChevronLeft className='h-4 w-4'/></Button><button className='rounded-md px-3 py-1 text-sm font-medium hover:bg-accent' onClick={()=>setWeekOffset(0)}>{formatDateRange(start,end)}</button><Button variant='ghost' size='icon-sm' onClick={()=>setWeekOffset((o)=>o+1)}><ChevronRight className='h-4 w-4'/></Button></div><Button size='sm' className='gap-1' onClick={()=>api.post('/tasks/task-id/time-entries',{body:{duration:1}})}><Plus className='h-3 w-3'/>Add task</Button></div>
    <div className='flex-1 overflow-auto'>{loading ? <div className='p-6'><Skeleton className='h-12 w-full'/></div> : <table className='w-full border-collapse'><thead><tr className='border-b border-border'><th className='sticky left-0 z-10 bg-background px-4 py-2 text-left text-2xs font-medium uppercase tracking-wider text-muted-foreground min-w-[240px]'>Task / Location</th>{dates.map((d,i)=><th key={i} className='px-3 py-2 text-center text-2xs font-medium uppercase tracking-wider min-w-[80px]'><div>{dayLabels[i]}</div><div className='text-xs font-normal mt-0.5'>{d.getDate()}</div></th>)}<th className='px-3 py-2 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground min-w-[80px]'>Total</th></tr></thead><tbody>{entries.length>0 ? <>{entries.map((entry)=>{const rowTotal=entry.daily.reduce((a,b)=>a+b,0);return <tr key={entry.id} className='border-b border-border/50 hover:bg-accent/30 transition-colors'><td className='sticky left-0 z-10 bg-background px-4 py-2'><div className='text-sm font-medium truncate'>{entry.taskName}</div><div className='text-2xs text-muted-foreground truncate'>{entry.location}</div></td>{entry.daily.map((val,i)=><td key={i} className='px-3 py-2 text-center text-sm tabular-nums'>{val}h</td>)}<td className='px-3 py-2 text-center text-sm font-medium tabular-nums'>{rowTotal}h</td></tr>})}<tr className='border-t-2 border-border bg-muted/30'><td className='sticky left-0 z-10 bg-muted/30 px-4 py-2 text-sm font-semibold'>Total</td>{totals.map((t,i)=><td key={i} className='px-3 py-2 text-center text-sm font-semibold tabular-nums'>{t}h</td>)}<td className='px-3 py-2 text-center text-sm font-bold tabular-nums'>{grandTotal}h</td></tr></> : <tr><td colSpan={9}><FadeIn delay={0.15}><div className='flex flex-col items-center justify-center py-20'><div className='flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4'><Clock className='h-8 w-8 text-muted-foreground/50'/></div><h3 className='text-sm font-medium text-foreground mb-1'>No time entries for this week</h3></div></FadeIn></td></tr>}</tbody></table>}</div>
  </div>
}
