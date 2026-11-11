import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

// The notices above the workspace: the browser preview, hidden windows, and the recording reminder with its choices.
export function ShellBanners() {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <>
      {ws.mode === 'mock' ? (
        <div className="border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground">
          {t('app.previewBanner')}
        </div>
      ) : null}
      {ws.state?.privacy.concealed ? (
        <div className="border-b border-border px-4 py-2 text-center text-xs">{t('app.concealed')}</div>
      ) : null}
      {ws.recordingReminder ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b bg-card p-4"
          role="alert"
          aria-label={t('app.reminder')}
        >
          <p className="text-sm">{t('app.reminderText')}</p>
          <div className="flex gap-2">
            <Button onClick={ws.continueRecording}>{t('app.continue')}</Button>
            <Button variant="outline" onClick={() => void ws.act(() => ws.audio.stop())}>
              {t('app.stopNow')}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
