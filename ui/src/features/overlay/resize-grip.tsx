import { useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'

// Drag handle on the panel's top-right corner. The bar stays anchored at the bottom, so dragging up makes the
// panel taller and dragging right makes it wider.
export function ResizeGrip({
  label,
  onResize,
}: {
  label: string
  onResize: (size: { width: number; height: number }) => void
}) {
  const start = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      data-no-drag
      className="absolute top-1 right-1 flex size-7 cursor-nesw-resize touch-none items-center justify-center rounded-md border border-white/20 text-muted-foreground hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-primary"
      onKeyDown={(event) => {
        const steps: Record<string, [number, number]> = {
          ArrowLeft: [-24, 0],
          ArrowRight: [24, 0],
          ArrowUp: [0, 24],
          ArrowDown: [0, -24],
          Enter: [24, 24],
          ' ': [24, 24],
        }
        const step = steps[event.key]
        if (!step) return
        event.preventDefault()
        onResize({ width: window.outerWidth + step[0], height: window.outerHeight + step[1] })
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        start.current = { x: event.screenX, y: event.screenY, width: window.outerWidth, height: window.outerHeight }
      }}
      onPointerMove={(event) => {
        const origin = start.current
        if (!origin) return
        onResize({
          width: origin.width + (event.screenX - origin.x),
          height: origin.height - (event.screenY - origin.y),
        })
      }}
      onPointerUp={() => {
        start.current = null
      }}
      onPointerCancel={() => {
        start.current = null
      }}
      onLostPointerCapture={() => {
        start.current = null
      }}
    >
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </div>
  )
}
