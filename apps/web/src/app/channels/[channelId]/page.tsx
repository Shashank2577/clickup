import { AppShell } from '@/components/layout/app-shell'
import { ChannelView } from '@/components/views/channel-view'

export default function ChannelPage({
  params,
}: {
  params: { channelId: string }
}) {
  return (
    <AppShell>
      <ChannelView channelId={params.channelId} />
    </AppShell>
  )
}
