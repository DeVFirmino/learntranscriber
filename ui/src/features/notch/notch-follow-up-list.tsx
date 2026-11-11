import { MessageCircleMore as Lightbulb } from 'lucide-react'
import { SuggestionChip } from '@/components/ui/suggestion-chip'
import { Button } from '@/components/ui/button'
import type { InsightFollowUps } from '@/features/notch-follow-ups'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

function generateLabel(state: InsightFollowUps | undefined) {
  if (state?.loaded) return 'notch.refresh'
  if (state?.busy) return 'notch.generating'
  return 'notch.generate'
}

// Follow-up questions for the insight shown: generate or refresh them, cancel while they load, and ask one.
export function NotchFollowUpList({
  state,
  onGenerate,
  onCancel,
  onAsk,
}: {
  state: InsightFollowUps | undefined
  onGenerate: () => void
  onCancel: () => void
  onAsk: (prompt: string) => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <div className="mt-2 border-t border-border pt-2" aria-label={t('notch.followUps')}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" disabled={Boolean(ws.requestId) || state?.busy} onClick={onGenerate}>
          <Lightbulb className="size-4" />
          {t(generateLabel(state))}
        </Button>
        {state?.busy ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t('notch.cancelSuggestions')}
          </Button>
        ) : null}
      </div>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.loaded && !state.suggestions.length ? (
        <p className="text-xs text-muted-foreground">{t('notch.noSuggestions')}</p>
      ) : null}
      {state?.suggestions.length ? (
        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {state.suggestions.map((item, index) => (
            <SuggestionChip
              key={index}
              title={item.prompt}
              disabled={Boolean(ws.requestId)}
              onClick={() => onAsk(item.prompt)}
            >
              {item.text}
            </SuggestionChip>
          ))}
        </div>
      ) : null}
    </div>
  )
}
