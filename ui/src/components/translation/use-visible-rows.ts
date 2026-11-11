import { useEffect, useState, type RefObject } from 'react'
import type { Entry } from '@/bridge/types/sessions'

// Which transcript rows are inside the scroll viewport right now, kept in sync with scrolling and resizing.
export function useVisibleRows(root: RefObject<HTMLDivElement | null>, open: boolean, entries: Entry[]) {
  const [visible, setVisible] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    const viewport = root.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    const measure = () => {
      const bounds = viewport.getBoundingClientRect()
      const ids = [...viewport.querySelectorAll<HTMLElement>('[data-transcript-id]')]
        .filter((row) => {
          const rect = row.getBoundingClientRect()
          return rect.bottom > bounds.top && rect.top < bounds.bottom
        })
        .map((row) => row.dataset.transcriptId || '')
      setVisible((previous) => (previous.join('\0') === ids.join('\0') ? previous : ids))
    }
    measure()
    viewport.addEventListener('scroll', measure)
    const resize = new ResizeObserver(measure)
    resize.observe(viewport)
    return () => {
      viewport.removeEventListener('scroll', measure)
      resize.disconnect()
    }
  }, [open, entries, root])
  return visible
}
