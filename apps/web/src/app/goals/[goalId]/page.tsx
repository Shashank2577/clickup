import { AppShell } from '@/components/layout/app-shell'
import { GoalDetail } from '@/components/views/goal-detail'

export default function GoalDetailPage({
  params,
}: {
  params: { goalId: string }
}) {
  return (
    <AppShell>
      <GoalDetail goalId={params.goalId} />
    </AppShell>
  )
}
