import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { useFileTranscription } from './use-file-transcription'

// Sessions page: choose an audio or video file and transcribe it into a new session, with progress and Cancel.
export function TranscribeFileButton() {
  const ws = useWorkspace()
  const { t } = useT()
  const input = useRef<HTMLInputElement>(null)
  const { state, start, cancel } = useFileTranscription()
  if (state.phase !== 'idle')
    return (
      <>
        <span className="self-center text-sm text-muted-foreground" role="status">
          {state.phase === 'decoding'
            ? t('fileTranscription.decoding', { name: state.name })
            : t('fileTranscription.progress', { done: state.done + 1, total: state.total })}
        </span>
        <Button variant="outline" onClick={cancel}>
          {t('data.cancel')}
        </Button>
      </>
    )
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void start(file)
        }}
      />
      <Button
        variant="outline"
        disabled={Boolean(ws.state?.activeSessionId)}
        title={ws.state?.activeSessionId ? t('fileTranscription.endFirst') : undefined}
        onClick={() => input.current?.click()}
      >
        {t('fileTranscription.choose')}
      </Button>
    </>
  )
}
