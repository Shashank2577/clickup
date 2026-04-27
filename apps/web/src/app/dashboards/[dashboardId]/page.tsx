import { AppShell } from '@/components/layout/app-shell'
import { DashboardView } from '@/components/views/dashboard-view'

export default function DashboardDetailPage({
  params,
}: {
  params: { dashboardId: string }
}) {
  return (
    <AppShell>
      <DashboardView dashboardId={params.dashboardId} />
    </AppShell>
  )
}
