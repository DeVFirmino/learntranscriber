import { ActionButton } from '@/components/ui/action-button'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { SessionSummary } from './session-summary'

export function SummaryEditor() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.session) return null
  return (
    <SessionSummary content={ws.session.summary || ''} actions={ws.api}>
      <ActionButton onClick={() => void ws.act(() => ws.runGeneration('summary'))} disabled={Boolean(ws.requestId)}>
        {t('summary.generate')}
      </ActionButton>
    </SessionSummary>
  )
}
