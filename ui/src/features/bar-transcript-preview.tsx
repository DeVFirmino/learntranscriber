import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import {
  nextPreviewLine,
  previewCaptions,
  previewTail,
  type PreviewCaptions,
  type PreviewLine,
} from '@/features/bar-preview-line'

// The recording bar's live transcript row, shown while capture runs with the session panel collapsed and its
// session surfaces are hidden.
export function BarTranscriptPreview({
  captions,
  lastLine,
  connecting,
}: {
  captions: Record<string, string>
  lastLine: PreviewLine | null
  connecting: boolean
}) {
  const { t } = useT()
  const ws = useWorkspace()
  const paused = Boolean(ws.state?.overlay.listening?.paused)
  const current = previewCaptions(captions)
  const [seen, setSeen] = useState<{ captions: PreviewCaptions; line: PreviewLine | null }>({
    captions: { me: '', them: '' },
    line: null,
  })
  if (seen.captions.me !== current.me || seen.captions.them !== current.them)
    setSeen({ captions: current, line: nextPreviewLine(seen.captions, current, seen.line) })
  const line = seen.line || lastLine
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('overlay.preview')}
      data-bar-preview
      className="flex h-7 min-w-0 shrink-0 items-center gap-2 rounded-full bg-white/5 px-3 text-xs"
    >
      <span
        className={`size-2 shrink-0 rounded-full ${paused ? 'bg-muted-foreground' : 'animate-pulse bg-red-500 motion-reduce:animate-none'}`}
        aria-hidden="true"
      />
      {line && !paused ? (
        <p className="min-w-0 truncate">
          <span className="font-semibold text-muted-foreground">
            {line.speaker === 'me' ? t('overlay.previewMe') : t('overlay.previewThem')}:
          </span>{' '}
          {previewTail(line.text)}
        </p>
      ) : (
        <p className="min-w-0 truncate text-muted-foreground">
          {paused
            ? t('overlay.previewPaused')
            : connecting
              ? t('overlay.previewConnecting')
              : t('overlay.previewListening')}
        </p>
      )}
      <div className="ml-auto flex shrink-0 gap-0.5">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t('overlay.audioSources')}
          title={t('overlay.audioSources')}
          onClick={() =>
            void ws.act(async () => {
              await ws.api.openAudioSources()
            })
          }
        >
          <SlidersHorizontal />
        </Button>
      </div>
    </div>
  )
}
