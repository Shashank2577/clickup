import { AppShell } from '@/components/layout/app-shell'
import { MyTasksView } from '@/components/views/my-tasks'

export default function MyTasksPage() {
  return (
    <AppShell>
      <MyTasksView />
    </AppShell>
  )
}
