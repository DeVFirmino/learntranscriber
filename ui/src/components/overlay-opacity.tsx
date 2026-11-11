import { useRef, useState } from 'react'
import './overlay-opacity.css'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The floating assistant's opacity, in percent. Used in Privacy and inside the floating window itself.
export function OverlayOpacity({ value, compact = false }: { value: number; compact?: boolean }) {
  const ws = useWorkspace()
  const { t } = useT()
  // While dragging, the slider shows the dragged value; otherwise the saved one, which also follows changes made
  // elsewhere (the opacity shortcuts or the other window) without overriding a drag in progress.
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = dragged ?? value
  const revision = useRef(0)
  return (
    <span
      className={`opacity-control ${compact ? 'opacity-compact flex w-28 shrink-0 items-center gap-2' : 'flex w-44 items-center gap-3'}`}
    >
      <output
        className={
          compact
            ? 'w-9 shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground'
            : 'w-10 shrink-0 whitespace-nowrap text-sm'
        }
      >
        <span key={shown} className="opacity-readout">
          {shown}%
        </span>
      </output>
      <input
        type="range"
        className="opacity-range"
        min={25}
        max={100}
        step={1}
        value={shown}
        aria-label={t('privacy.opacity')}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          const current = ++revision.current
          setDragged(next)
          for (const surface of typeof document === 'undefined'
            ? []
            : document.querySelectorAll<HTMLElement>('[data-floating]'))
            surface.style.setProperty('--floating-frame-opacity', String(next / 100))
          void ws
            .act(async () => {
              await ws.api.settings({ overlayOpacity: next / 100 })
            })
            .finally(() => {
              if (current === revision.current) setDragged(null)
            })
        }}
      />
    </span>
  )
}
