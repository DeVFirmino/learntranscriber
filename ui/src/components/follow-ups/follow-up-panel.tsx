import { MessageCircleMore as Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FollowUpSuggestion } from '@/bridge/types/generation'
import { useT } from '@/use-t'
import { SuggestionChip } from '@/components/ui/suggestion-chip'

// The full follow-up panel: a generate or refresh button, a cancel while busy, and the suggestions as buttons.
export function FollowUpPanel({
  suggestions,
  busy,
  loaded,
  error,
  disabled,
  requesting,
  responseLength,
  onGenerate,
  onStop,
  onSelect,
}: {
  suggestions: FollowUpSuggestion[]
  busy: boolean
  loaded: boolean
  error: string
  disabled: boolean
  requesting: boolean
  responseLength: number
  onGenerate: () => void
  onStop: () => void
  onSelect: (prompt: string) => void
}) {
  const { t } = useT()
  return (
    <div className="mt-4 grid gap-2 border-t pt-3" role="group" aria-label={t('followUps.group')}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onGenerate}>
          <Lightbulb className="size-4" />
          {busy ? t('notch.generating') : loaded ? t('notch.refresh') : t('notch.generate')}
        </Button>
        {busy ? (
          <Button variant="ghost" size="sm" onClick={onStop}>
            {t('notch.cancelSuggestions')}
          </Button>
        ) : null}
      </div>
      {responseLength < 50 ? <p className="text-xs text-muted-foreground">{t('followUps.short')}</p> : null}
      {busy ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('followUps.using')}
        </p>
      ) : null}
      {loaded && !suggestions.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('followUps.empty')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((item, index) => (
            <SuggestionChip key={index} title={item.prompt} disabled={requesting} onClick={() => onSelect(item.prompt)}>
              {item.text}
            </SuggestionChip>
          ))}
        </div>
      ) : null}
    </div>
  )
}
