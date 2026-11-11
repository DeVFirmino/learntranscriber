import { Minus, Lightbulb as Sparkles, X } from 'lucide-react'
import { BrandSettings as Settings2 } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import type { NotchPointer } from './use-notch-pointer'

// The expanded Notch's header, which drags it: the title, text size, an insight on demand, settings and collapse.
// The text size is the floating assistant's too, adjusted with the A buttons in either window.
export function NotchHeader({
  pointer,
  settingsOpen,
  onSettingsOpen,
}: {
  pointer: NotchPointer
  settingsOpen: boolean
  onSettingsOpen: (change: (open: boolean) => boolean) => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const fontScale = ws.state?.settings.unifiedModalFontScale ?? 1
  const adjustFont = (step: number) =>
    void ws.act(async () => {
      const next = Math.max(0.7, Math.min(1.6, Math.round((fontScale + step) * 10) / 10))
      await ws.api.settings({ unifiedModalFontScale: next })
    })
  return (
    <header
      className="mb-3 flex cursor-grab touch-none select-none items-center justify-between gap-2 active:cursor-grabbing"
      aria-label={t('notch.drag')}
      onPointerDown={pointer.beginDrag}
      onPointerMove={pointer.updateDrag}
      onPointerUp={pointer.endDrag}
      onPointerCancel={pointer.endDrag}
    >
      <strong className="text-sm">{settingsOpen ? t('notch.settings') : t('notch.insights')}</strong>
      <div className="flex items-center gap-1">
        {!settingsOpen ? (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('overlay.fontDown')}
              disabled={fontScale <= 0.7}
              onClick={() => adjustFont(-0.1)}
            >
              <span className="text-[11px] font-semibold">A</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('overlay.fontUp')}
              disabled={fontScale >= 1.6}
              onClick={() => adjustFont(0.1)}
            >
              <span className="text-base font-semibold">A</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={!ws.state?.activeSessionId || Boolean(ws.requestId)}
              onClick={() => void ws.act(() => ws.runGeneration('insight'))}
            >
              <Sparkles className="size-3.5" />
              {t('notch.runNow')}
            </Button>
          </>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={settingsOpen ? t('notch.closeSettings') : t('notch.openSettings')}
          aria-pressed={settingsOpen}
          onClick={() => onSettingsOpen((open) => !open)}
        >
          {settingsOpen ? <X /> : <Settings2 />}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={t('notch.collapse')} onClick={pointer.collapse}>
          <Minus />
        </Button>
      </div>
    </header>
  )
}
