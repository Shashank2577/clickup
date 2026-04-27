import { AppShell } from '@/components/layout/app-shell'
import { DocEditor } from '@/components/views/doc-editor'

export default function DocPage({
  params,
}: {
  params: { docId: string }
}) {
  return (
    <AppShell>
      <DocEditor docId={params.docId} />
    </AppShell>
  )
}
