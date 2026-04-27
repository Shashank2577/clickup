import { AppShell } from '@/components/layout/app-shell'
import { SpaceView } from '@/components/views/space-view'

export default function ListPage({
  params,
}: {
  params: { spaceId: string; listId: string }
}) {
  return (
    <AppShell>
      <SpaceView />
    </AppShell>
  )
}
