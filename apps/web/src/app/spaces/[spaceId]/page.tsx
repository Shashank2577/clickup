import { AppShell } from '@/components/layout/app-shell'
import { SpaceOverview } from '@/components/views/space-overview'

export default function SpacePage({ params }: { params: { spaceId: string } }) {
  return (
    <AppShell>
      <SpaceOverview spaceId={params.spaceId} />
    </AppShell>
  )
}
