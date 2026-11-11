import type { SessionDetail } from '@/bridge/types/sessions'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Actions } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The session's compacted memory: its size in tokens, its text, and compacting again or undoing the last one.
export function SessionMemory({ session }: { session: SessionDetail }) {
  const ws = useWorkspace()
  const { t } = useT()
  const tokens = session.compaction?.estimatedTokens?.toLocaleString(document.documentElement.lang || undefined)
  return (
    <Collapsible className="mb-4 border-b pb-3">
      <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
        {tokens ? t('session.memory', { tokens }) : t('session.memoryLabel')}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 pt-3">
        <p className="whitespace-pre-wrap text-sm">{session.compaction?.summary || t('session.noMemory')}</p>
        <Actions>
          <Button
            variant="outline"
            disabled={Boolean(ws.requestId)}
            onClick={() => void ws.act(() => ws.runGeneration('compact'))}
          >
            {t('session.compact')}
          </Button>
          <Button
            variant="outline"
            disabled={!session.compaction?.count || Boolean(ws.requestId)}
            onClick={() =>
              void ws.act(async () => {
                await ws.api.undoCompaction(session.id)
                await ws.refreshSession()
              })
            }
          >
            {t('session.undoCompact')}
          </Button>
        </Actions>
        <p className="text-xs text-muted-foreground">{t('session.compactHint')}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
