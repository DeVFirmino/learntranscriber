import { VoiceMark } from '@/components/voice-mark'
import { useT } from '@/use-t'
import { useWorkspace, useWorkspaceLive } from '@/workspace'

// The session page's parts that change with every caption and streamed word; they read the live context so the
// rest of the page renders only when the session itself changes.
export function SessionLiveCaptions() {
  const { liveCaptions } = useWorkspaceLive()
  const { t } = useT()
  const speaking = Object.entries(liveCaptions).filter(([, text]) => Boolean(text))
  if (!speaking.length) return null
  return (
    <div className="mb-4 grid gap-2 rounded-xl border p-4" aria-label={t('session.liveCaptions')} aria-live="polite">
      {speaking.map(([speaker, text]) => (
        <p key={speaker} className="text-sm">
          <strong>{t('session.draft', { speaker })}</strong>
          {text}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">{t('session.draftsNote')}</p>
    </div>
  )
}

export function SessionPendingExchange() {
  const { requestId } = useWorkspace()
  const { pendingQuestion, answer } = useWorkspaceLive()
  const { t } = useT()
  return (
    <>
      {pendingQuestion ? (
        <div className="border-b py-3">
          <strong className="text-xs text-muted-foreground">{t('overlay.you')}</strong>
          <p className="mt-1 whitespace-pre-wrap text-sm">{pendingQuestion}</p>
        </div>
      ) : null}
      {requestId ? (
        <div className="py-3">
          <strong className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <VoiceMark active className="!size-4" />
            {answer ? t('session.responding') : t('session.connecting')}
          </strong>
          <p className="mt-1 whitespace-pre-wrap text-sm">{answer}</p>
        </div>
      ) : null}
    </>
  )
}
