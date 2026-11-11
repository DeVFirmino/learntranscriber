import { useEffect } from 'react'
import { useWorkspace } from '@/workspace'
import type { View } from './panel-view'

// Scroll and response shortcuts act on the panel's scroll area while it is shown:
// scrolling moves 150 pixels and the response shortcuts jump between the Session tab's answer cards.
export function usePanelScrollActions(view: View) {
  const ws = useWorkspace()
  useEffect(
    () =>
      ws.api.onAction((action) => {
        const viewport = document.querySelector<HTMLElement>('[data-panel-scroll] [data-slot="scroll-area-viewport"]')
        if (!viewport) return
        if (action === 'scrollUp' || action === 'scrollDown')
          viewport.scrollBy({ top: action === 'scrollUp' ? -150 : 150 })
        if ((action === 'previousResponse' || action === 'nextResponse') && view === 'session') {
          const top = viewport.getBoundingClientRect().top
          const cards = [...viewport.querySelectorAll<HTMLElement>('[data-answer-card]')]
          const target =
            action === 'previousResponse'
              ? cards.findLast((card) => card.getBoundingClientRect().top < top - 1)
              : cards.find((card) => card.getBoundingClientRect().top > top + 1)
          target?.scrollIntoView({ block: 'start' })
        }
      }),
    [ws.api, view],
  )
}
