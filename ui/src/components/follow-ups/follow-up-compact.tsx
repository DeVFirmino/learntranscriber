import { MessageCircleMore, RefreshCw } from 'lucide-react'
import type { FollowUpSuggestion } from '@/bridge/types/generation'
import { Button } from '@/components/ui/button'
import { SuggestionChip } from '@/components/ui/suggestion-chip'
import { useT } from '@/use-t'
import './follow-up-compact.css'

export function FollowUpCompact({
  suggestions,
  busy,
  loaded = false,
  error,
  disabled,
  requesting,
  responseLength = 100,
  onGenerate,
  onStop,
  onSelect,
}: {
  suggestions: FollowUpSuggestion[]
  busy: boolean
  loaded?: boolean
  error: string
  disabled: boolean
  requesting: boolean
  responseLength?: number
  onGenerate: () => void
  onStop?: () => void
  onSelect: (prompt: string) => void
}) {
  const { t } = useT()
  let label = t('followUps.group')
  if (loaded) label = t('notch.refresh')
  if (busy) label = t('followUps.loading')
  return (
    <div data-follow-up-suggestions className="floating-follow-ups" role="group" aria-label={t('followUps.group')}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={loaded ? 'ghost' : 'outline'} size="sm" disabled={disabled} onClick={onGenerate}>
          {busy ? (
            <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <MessageCircleMore className="size-3.5" aria-hidden="true" />
          )}
          {label}
        </Button>
        {busy && onStop ? (
          <Button type="button" variant="ghost" size="sm" onClick={onStop}>
            {t('notch.cancelSuggestions')}
          </Button>
        ) : null}
      </div>
      {responseLength < 50 ? <p className="text-xs text-muted-foreground">{t('followUps.short')}</p> : null}
      {busy ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('followUps.generating')}
        </p>
      ) : null}
      {loaded && !suggestions.length ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('followUps.empty')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
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
