import { Button } from '@/components/ui/button'
import { MessageBubble } from '@/components/ui/message-bubble'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useT } from '@/use-t'
import { BuilderDraft } from './assistant-builder/builder-draft'
import { BuilderForm } from './assistant-builder/builder-form'
import { BuilderProposalList } from './assistant-builder/builder-proposal-list'
import { BuilderResults } from './assistant-builder/builder-results'
import { useAssistantBuilder } from './assistant-builder/use-assistant-builder'
import './assistant-builder/builder.css'
import '@/components/ui/chat-thread.css'

// The assistant builder panel: the conversation and its proposals on one side, the draft on the other.
export function AssistantBuilder({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const builder = useAssistantBuilder()
  const close = () => {
    builder.cancel()
    onClose()
  }
  return (
    <Card className="mb-6" aria-label={t('builder.region')}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{t('builder.title')}</CardTitle>
          <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">{t('builder.hint')}</p>
        </div>
        <Button type="button" variant="ghost" onClick={close}>
          {t('builder.close')}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 min-[1000px]:grid-cols-2">
        <div className="grid content-start gap-4">
          {builder.turns.length ? (
            <div className="chat-thread max-h-80 overflow-auto pr-1" role="log" aria-label={t('builder.conversation')}>
              {builder.turns.map((turn, index) => (
                <MessageBubble
                  key={index}
                  role={turn.role}
                  className="whitespace-pre-wrap"
                  aria-label={turn.role === 'user' ? t('overlay.you') : t('builder.builder')}
                >
                  {turn.content}
                </MessageBubble>
              ))}
            </div>
          ) : null}
          <BuilderForm
            refining={Boolean(builder.draft)}
            busy={builder.busy}
            error={builder.error}
            onSubmit={(question, answered) => void builder.submit(question, answered)}
            onCancel={builder.cancel}
          />
          <BuilderResults results={builder.results} />
          {builder.proposals.length ? (
            <BuilderProposalList
              proposals={builder.proposals}
              draftName={builder.draft?.name}
              busy={builder.busy}
              onApply={builder.apply}
              onDismiss={builder.dismiss}
            />
          ) : null}
          {builder.finished ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{t('builder.finished')}</p>
              <Button type="button" size="sm" variant="outline" onClick={close}>
                {t('builder.close')}
              </Button>
            </div>
          ) : null}
        </div>
        <div
          className="min-w-0 border-t pt-5 min-[1000px]:border-t-0 min-[1000px]:border-l min-[1000px]:pl-6 min-[1000px]:pt-0"
          aria-label={t('builder.generated')}
        >
          <BuilderDraft draft={builder.draft} busy={builder.busy} />
        </div>
      </CardContent>
    </Card>
  )
}
