import { useEffect, type RefObject } from 'react'
import { useWorkspace } from '@/workspace'

// Tells the app an automatic insight was really shown: only once the latest answer is on screen in a visible,
// expanded, unconcealed Notch, two frames after it rendered. The acknowledgement then clears.
export function useDisplayAck({
  contentRef,
  displayAckId,
  setDisplayAckId,
  settingsOpen,
  position,
  streaming,
}: {
  contentRef: RefObject<HTMLDivElement | null>
  displayAckId: string | null
  setDisplayAckId: (change: (current: string | null) => string | null) => void
  settingsOpen: boolean
  position: number
  streaming: boolean
}) {
  const ws = useWorkspace()
  useEffect(() => {
    if (
      !displayAckId ||
      settingsOpen ||
      !ws.state?.notch.expanded ||
      !ws.state.notch.visible ||
      ws.state.privacy.concealed ||
      position >= 0 ||
      streaming
    )
      return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const content = contentRef.current
        if (
          cancelled ||
          content?.dataset.displayAckId !== displayAckId ||
          !content.querySelector('.assistant-response')?.textContent?.trim()
        )
          return
        void ws.api
          .displayNotchInsight(displayAckId)
          .then((accepted) => {
            if (accepted && !cancelled) setDisplayAckId((current) => (current === displayAckId ? null : current))
          })
          .catch(() => {})
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [
    contentRef,
    setDisplayAckId,
    displayAckId,
    settingsOpen,
    position,
    ws.api,
    ws.state?.notch.expanded,
    ws.state?.notch.visible,
    ws.state?.privacy.concealed,
    streaming,
  ])
}
