import { ActionButton } from '@/components/ui/action-button'
import type { SessionDetail } from '@/bridge/types/sessions'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SummaryEditor } from '@/components/summary-editor'
import { TranscriptTranslation } from '@/components/transcript-translation'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The session's record: transcript, summary and translation tabs, and the text attached to it.
export function SessionNotes({ session }: { session: SessionDetail }) {
  const ws = useWorkspace()
  const { t } = useT()
  const state = ws.state
  if (!state) return null
  return (
    <section className="session-notes min-w-0" aria-label={t('session.notes')}>
      <div>
        <Tabs
          value={ws.sessionTab}
          onValueChange={(value) => ws.setSessionTab(value as 'transcript' | 'summary' | 'translation')}
        >
          <TabsList variant="line">
            <TabsTrigger value="transcript">{t('overlay.transcript')}</TabsTrigger>
            <TabsTrigger value="summary">{t('overlay.summary')}</TabsTrigger>
            <TabsTrigger value="translation">{t('session.translation')}</TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" forceMount className="data-[state=inactive]:hidden">
            <TranscriptTranslation
              key={session.id}
              sessionId={session.id}
              entries={session.entries.filter((entry) => entry.kind === 'transcript')}
              language={state.settings.translationLanguage}
              open={ws.sessionTab === 'transcript'}
              follow={state.settings.autoScroll}
              api={ws.api}
            />
          </TabsContent>
          <TabsContent value="summary" className="grid gap-3">
            <SummaryEditor />
          </TabsContent>
          <TabsContent value="translation" className="grid gap-3">
            {state.settings.translationLanguage.trim() ? (
              <ActionButton className="w-fit" onClick={() => void ws.act(() => ws.runGeneration('translation'))}>
                {t('session.translate')}
              </ActionButton>
            ) : (
              <p className="text-sm text-muted-foreground">{t('error.translationOffChooseLanguage')}</p>
            )}
            <p className="whitespace-pre-wrap text-sm">{session.translation || t('session.translationEmpty')}</p>
          </TabsContent>
        </Tabs>
        {session.context.length ? (
          <Collapsible className="mt-4 border-t pt-4">
            <CollapsibleTrigger className="text-sm">
              {t('session.attached', { count: session.context.length })}
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-3 pt-3">
              {session.context.map((item) => (
                <div key={item.id}>
                  <h3 className="text-sm font-medium">{item.source}</h3>
                  <pre className="mt-1 whitespace-pre-wrap text-sm">
                    {item.content.slice(0, 5000)}
                    {item.content.length > 5000 ? '\n' + t('session.shortened') : ''}
                  </pre>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </section>
  )
}
