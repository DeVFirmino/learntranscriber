import type { ReactNode } from 'react'
import type { AudioCapture } from '@/audio/capture'
import { BrandListen } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { SessionLiveCaptions } from '@/features/session-live'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

function statusKey(audio: AudioCapture) {
  if (audio.recording) return 'session.listening'
  if (audio.stopping) return 'session.finishing'
  return 'session.notListening'
}

// Whether the session is listening, its start, stop and mute buttons, what is being said now, and the recorded
// segments still waiting to be transcribed.
export function SessionListening({ active, children }: { active: boolean; children?: ReactNode }) {
  const ws = useWorkspace()
  const { t } = useT()
  const audio = ws.audio
  const status = `${t(statusKey(audio))}${audio.pending ? t('session.processing', { count: audio.pending }) : ''}`
  return (
    <>
      <div className="session-controls" role="group" aria-label={t('session.controls')}>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${audio.recording ? 'bg-blue-400' : 'bg-muted-foreground'}`}
            />
            {status}
          </p>
          {active ? (
            <Button
              disabled={audio.stopping}
              onClick={() =>
                void ws.act(async () => {
                  await ws.toggleListening()
                })
              }
            >
              {!audio.recording ? <BrandListen className="size-4 [--brand-icon-accent:currentColor]" /> : null}
              {audio.recording ? t('session.stopListening') : t('session.startListening')}
            </Button>
          ) : null}
          {audio.recording ? (
            <Button variant="outline" onClick={() => audio.muteMicrophone()}>
              {audio.muted ? t('session.unmute') : t('session.mute')}
            </Button>
          ) : null}
        </div>
        {children ? <div className="session-control-actions">{children}</div> : null}
      </div>
      <SessionLiveCaptions />
      {audio.failed.length ? (
        <p className="mb-4 text-sm text-destructive">
          {t('session.held', { count: audio.failed.length })}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => void ws.act(() => audio.retry())}>
            {t('session.retryTranscription')}
          </Button>
        </p>
      ) : null}
    </>
  )
}
