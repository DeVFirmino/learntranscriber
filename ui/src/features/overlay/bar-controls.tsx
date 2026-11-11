import { useEffect, useState } from 'react'
import { LoaderCircle, Pause, Play, Square } from 'lucide-react'
import { BrandHome, BrandListen, BrandStealth } from '@/components/brand-icon'
import { SessionPanelGlyph, ShortcutKeyGlyph } from '@/components/bar-glyphs'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { elapsedSeconds, formatElapsed } from './listening-clock'
import { VoiceWave } from './voice-wave'

// The bar's control row: home, mute, the listening status with its timer, pause, start or stop, expand, hide, and
// the shortcut key that opens the shortcut sheet (holding Command opens it too).
export function BarControls({ shortcutsOpen, onShortcuts }: { shortcutsOpen: boolean; onShortcuts: () => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())
  const listening = Boolean(ws.state?.overlay.listening?.active)
  useEffect(() => {
    if (!listening) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [listening])
  const state = ws.state
  if (!state) return null
  const paused = Boolean(state.overlay.listening?.paused)
  const starting = Boolean(state.overlay.listening?.starting)
  const clock = formatElapsed(elapsedSeconds(state.overlay.listening?.since ?? null, now))
  const toggleListening = () =>
    void ws.act(async () => {
      await ws.api.dispatchShortcut('toggleRecording')
    })
  return (
    <div data-bar-controls className="flex items-center justify-center gap-1.5">
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="rounded-full"
        onClick={() =>
          void ws.act(async () => {
            await ws.api.showMain()
          })
        }
        aria-label={t('overlay.home')}
        title={t('overlay.home')}
      >
        <BrandHome className="size-5" aria-hidden="true" />
      </Button>
      {listening ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          aria-label={t('overlay.muteMic')}
          title={t('overlay.muteMic')}
          onClick={() =>
            void ws.act(async () => {
              await ws.api.dispatchShortcut('mic')
            })
          }
        >
          <VoiceWave paused={paused} />
        </Button>
      ) : null}
      {!starting && !listening ? (
        <span className="size-2 rounded-full bg-amber-400" role="img" aria-label={t('overlay.statusReady')} />
      ) : null}
      <span className="mx-0.5 h-6 w-px bg-white/10" aria-hidden="true" />
      {starting ? (
        <span role="status" aria-live="polite" className="flex h-8 items-center gap-2 px-2 text-sm text-foreground">
          <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t('overlay.processing')}
        </span>
      ) : null}
      {!starting && listening ? (
        <>
          <span
            role="timer"
            aria-live="off"
            aria-label={t('overlay.statusListening')}
            className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground tabular-nums"
          >
            <span
              className={`size-1.5 rounded-full ${paused ? 'bg-muted-foreground' : 'animate-pulse bg-red-500 motion-reduce:animate-none'}`}
              aria-hidden="true"
            />
            {clock}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-lg"
            aria-label={t(paused ? 'overlay.resumeListening' : 'overlay.pauseListening')}
            title={t(paused ? 'overlay.resumeListening' : 'overlay.pauseListening')}
            aria-pressed={paused}
            onClick={() =>
              void ws.act(async () => {
                await ws.api.pauseListening()
              })
            }
          >
            {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-xl border-white/10 text-red-400"
            onClick={toggleListening}
            aria-label={t('overlay.stopListening')}
            title={t('overlay.stopListening')}
          >
            <Square className="size-4" aria-hidden="true" />
          </Button>
        </>
      ) : null}
      {!starting && !listening ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="rounded-xl border-white/10 text-foreground"
          onClick={toggleListening}
          data-start-listening
          aria-label={t('overlay.startListening')}
          title={`${t('overlay.startListening')} · ⌘D`}
        >
          <BrandListen className="size-5" aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() =>
          void ws.act(async () => {
            await ws.api.expandOverlay(!state.overlay.expanded)
          })
        }
        aria-label={t(state.overlay.expanded ? 'overlay.minimize' : 'overlay.expand')}
        title={t(state.overlay.expanded ? 'overlay.minimize' : 'overlay.expand')}
        aria-expanded={state.overlay.expanded}
      >
        <SessionPanelGlyph open={state.overlay.expanded} className="size-5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() =>
          void ws.act(async () => {
            await ws.api.toggleOverlay()
          })
        }
        aria-label={t('overlay.hideBar')}
        title={t('overlay.hideBarHint')}
      >
        <BrandStealth className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        data-shortcuts-key
        className={shortcutsOpen ? 'bg-[#1b3454] text-white' : ''}
        onClick={onShortcuts}
        aria-label={t('overlay.shortcutsTitle')}
        aria-expanded={shortcutsOpen}
        title={t('overlay.shortcutsHint')}
      >
        <ShortcutKeyGlyph className="size-5" />
      </Button>
    </div>
  )
}
