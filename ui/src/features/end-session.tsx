import { useEffect, useRef, useState } from 'react'
import type { SessionDetail } from '@/bridge/types/sessions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { errorMessage } from '@/format'
import { finishSession } from './finish-session'

// Ends the live session after listening stops and pending transcription finishes, optionally writing its summary.
export function EndSession({ session, active }: { session: SessionDetail; active: boolean }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [summarize, setSummarize] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (request.current) void ws.api.cancel(request.current)
    },
    [ws.api, session.id],
  )
  const finish = async () => {
    setBusy(true)
    setError('')
    try {
      await finishSession(session.id, summarize, {
        stopAudio: () => ws.audio.stop(),
        failedSegments: () => ws.audio.failed.length,
        cancelGeneration: async () => {
          if (ws.requestId) await ws.api.cancel(ws.requestId)
        },
        endSession: ws.api.endSession,
        session: ws.api.session,
        pendingAudioMessage: t('session.retryBeforeEnd'),
        generateSummary: async () => {
          const id = crypto.randomUUID()
          request.current = id
          try {
            await ws.api.generate({ requestId: id, sessionId: session.id, mode: 'summary' })
          } finally {
            request.current = null
          }
        },
      })
      setOpen(false)
      await ws.refreshSession()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {active ? (
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true)
            setError('')
          }}
        >
          {t('session.end')}
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next)
        }}
      >
        <DialogContent className="max-h-[85vh] grid-cols-1 overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t('session.end')}</DialogTitle>
            <DialogDescription>{t('session.endHint')}</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={summarize} onCheckedChange={(value) => setSummarize(value === true)} disabled={busy} />
            <span>{t('session.endWithSummary')}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t('data.cancel')}
            </Button>
            <Button disabled={busy} onClick={() => void finish()}>
              {busy ? t('session.ending') : t('session.end')}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
