import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty } from '@/components/chrome'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { Entry } from '@/bridge/types/sessions'
import { useT } from '@/use-t'
import { useVisibleRows } from './translation/use-visible-rows'
import { cacheKey, useTranslationQueue } from './translation/use-translation-queue'
import { TranslationEntryRow } from './translation/translation-entry'
import '@/components/ui/chat-thread.css'

// Live translations of the other side's transcript lines into the session's chosen language, requested as rows
// scroll into view.
export function TranscriptTranslation({
  sessionId,
  entries,
  language,
  open,
  follow,
  api,
}: {
  sessionId: string
  entries: Entry[]
  language: string
  open: boolean
  follow: boolean
  api: WorkspaceApi
}) {
  const { t } = useT()
  const root = useRef<HTMLDivElement>(null)
  const visible = useVisibleRows(root, open, entries)
  const { showOriginals, setShowOriginals, results, retry } = useTranslationQueue({
    sessionId,
    entries,
    language,
    open,
    api,
    visible,
  })
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {language.trim() ? (
          <>
            <p className="text-xs text-muted-foreground">{t('transcript.participant', { language })}</p>
            <Button size="sm" variant="ghost" onClick={() => setShowOriginals((value) => !value)}>
              {showOriginals ? t('transcript.showTranslations') : t('transcript.showOriginals')}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('transcript.translationOff')}</p>
        )}
      </div>
      <div ref={root}>
        <ScrollArea follow={follow} className="h-[440px] pr-3">
          {entries.length ? (
            <div className="chat-thread py-1">
              {entries.map((entry) => (
                <TranslationEntryRow
                  key={entry.id}
                  entry={entry}
                  result={results[cacheKey(sessionId, entry, language)]}
                  showOriginals={showOriginals}
                  onRetry={retry}
                />
              ))}
            </div>
          ) : (
            <Empty>{t('transcript.empty')}</Empty>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
