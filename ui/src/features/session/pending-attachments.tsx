import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// What goes with the next question: the queued screenshots, and selected or screen text to review before sending.
export function PendingAttachments({ sessionId }: { sessionId: string }) {
  const ws = useWorkspace()
  const { t } = useT()
  const textContext = ws.pendingText?.sessionId === sessionId ? ws.pendingText : null
  return (
    <>
      {ws.pendingImages.length ? (
        <div className="mt-3 grid gap-2" aria-label={t('session.screenshots')}>
          <p className="text-xs text-muted-foreground">
            {t('session.screenshotCount', { count: ws.pendingImages.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {ws.pendingImages.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                <img
                  src={item.data}
                  alt={t('session.screenshot', { index: index + 1 })}
                  className="h-16 w-24 rounded object-contain"
                />
                <span>#{index + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('session.removeScreenshot', { index: index + 1 })}
                  onClick={() => ws.removePendingImage(item.id)}
                >
                  {t('common.remove')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {textContext ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{textContext.label}</h3>
            <Button variant="outline" size="sm" onClick={() => ws.setPendingText(null)}>
              {t('session.discardText')}
            </Button>
          </div>
          <Field label={t('session.reviewText')}>
            <Textarea
              id="context-preview"
              rows={5}
              maxLength={20000}
              value={textContext.text}
              onChange={(event) => ws.patchPendingText(event.target.value)}
            />
          </Field>
          <p className="mt-2 text-xs text-muted-foreground">{t('session.reviewTextHint')}</p>
        </div>
      ) : null}
    </>
  )
}
