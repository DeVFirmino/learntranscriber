import { Button } from '@/components/ui/button'
import { MessageBubble } from '@/components/ui/message-bubble'
import type { Entry } from '@/bridge/types/sessions'
import { useT } from '@/use-t'
import type { TranslationResult } from './use-translation-queue'

// One transcript line as a bubble, the user's own speech on the right and others on the left: the original text, or
// its cached translation once the entry's content still matches it, with a pending or retryable error state for a
// participant line.
export function TranslationEntryRow({
  entry,
  result: candidate,
  showOriginals,
  onRetry,
}: {
  entry: Entry
  result: TranslationResult | undefined
  showOriginals: boolean
  onRetry: (entry: Entry) => void
}) {
  const { t } = useT()
  const result = candidate?.source === entry.content ? candidate : undefined
  return (
    <MessageBubble
      data-transcript-id={entry.id}
      role={entry.speaker === 'THEY' ? 'context' : 'user'}
      aria-label={entry.speaker === 'THEY' ? t('overlay.others') : t('overlay.you')}
    >
      <p className="message-bubble-meta">
        <span>{entry.speaker === 'THEY' ? t('overlay.others') : t('overlay.you')}</span>
        <span>{new Date(entry.created_at).toLocaleTimeString(document.documentElement.lang || undefined)}</span>
      </p>
      <div className="min-w-0">
        <p className="whitespace-pre-wrap">
          {showOriginals || entry.speaker !== 'THEY' || !result || result.status !== 'done'
            ? entry.content
            : result.text}
        </p>
        {!showOriginals && entry.speaker === 'THEY' && result?.status === 'pending' ? (
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {t('transcript.translating')}
          </p>
        ) : null}
        {!showOriginals && entry.speaker === 'THEY' && result?.status === 'error' ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p role="alert" className="text-xs text-destructive">
              {result.error}
            </p>
            <Button size="sm" variant="ghost" onClick={() => onRetry(entry)}>
              {t('transcript.retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </MessageBubble>
  )
}
