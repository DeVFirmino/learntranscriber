import { floatingFontSize } from './reading-size'
import { SessionSummary } from '@/components/session-summary'
import { Button } from '@/components/ui/button'
import type { SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The panel's Summary tab: the saved summary and a button to generate it again.
export function SummaryView({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <SessionSummary
      content={session?.summary || ''}
      actions={ws.api}
      fontScale={floatingFontSize(ws.state?.settings.unifiedModalFontScale ?? 1) / 14}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={!ws.state?.activeSessionId || Boolean(ws.requestId)}
        onClick={() => void ws.act(() => ws.runGeneration('summary'))}
      >
        {t('overlay.generateSummary')}
      </Button>
    </SessionSummary>
  )
}
