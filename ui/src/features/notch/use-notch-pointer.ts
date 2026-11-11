import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useWorkspace } from '@/workspace'
import { PointerGesture } from '@/features/notch-geometry'

// How the Notch answers the pointer: hovering the collapsed button expands it after 180 ms, collapsing blocks that
// until the pointer leaves, and the header drags and the corner resizes it. The window takes clicks only while hovered
// or held. `onCollapse` closes the settings the collapse hides.
export function useNotchPointer(onCollapse: () => void) {
  const ws = useWorkspace()
  const drag = useRef<PointerGesture | null>(null)
  const resize = useRef<PointerGesture | null>(null)
  const hovered = useRef(false)
  const hoverBlocked = useRef(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHover = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }, [])
  const syncInteraction = useCallback(() => {
    void ws.api.setNotchInteractive(hovered.current || Boolean(drag.current || resize.current)).catch(() => {})
  }, [ws.api])
  const enter = () => {
    hovered.current = true
    syncInteraction()
    if (ws.state?.notch.expanded || hoverBlocked.current || drag.current || resize.current) return
    cancelHover()
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null
      if (hovered.current && !hoverBlocked.current && !drag.current && !resize.current)
        void ws.act(() => ws.api.expandNotch(true).then(() => undefined))
    }, 180)
  }
  const leave = useCallback(() => {
    hovered.current = false
    hoverBlocked.current = false
    cancelHover()
    syncInteraction()
  }, [cancelHover, syncInteraction])
  const collapse = () => {
    hoverBlocked.current = true
    onCollapse()
    cancelHover()
    void ws.act(() => ws.api.expandNotch(false).then(() => undefined))
  }
  useEffect(() => {
    // Native viewport exit survives replacing the collapsed button with the expanded panel.
    const root = document.documentElement
    root.addEventListener('mouseleave', leave)
    return () => root.removeEventListener('mouseleave', leave)
  }, [leave])
  useEffect(
    () => () => {
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
      void ws.api.setNotchInteractive(false).catch(() => {})
    },
    [ws.api],
  )
  useEffect(() => {
    if (ws.state?.notch.visible && !ws.state.privacy.concealed) return
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    hovered.current = false
    hoverBlocked.current = false
    drag.current = null
    resize.current = null
  }, [ws.state?.notch.visible, ws.state?.privacy.concealed])

  const hold = (event: ReactPointerEvent<HTMLElement>) => {
    cancelHover()
    syncInteraction()
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  return {
    enter,
    leave,
    collapse,
    beginDrag(event: ReactPointerEvent<HTMLElement>) {
      if ((event.target as HTMLElement).closest('button,input,a') || !ws.state?.notch.bounds) return
      drag.current = new PointerGesture(event, ws.state.notch.bounds)
      hold(event)
    },
    updateDrag(event: ReactPointerEvent<HTMLElement>) {
      const gesture = drag.current
      const offset = gesture?.move(event)
      if (gesture && offset) void ws.api.moveNotch({ ...gesture.position(offset), commit: false }).catch(() => {})
    },
    endDrag(event: ReactPointerEvent<HTMLElement>) {
      const gesture = drag.current
      if (!gesture?.owns(event)) return
      drag.current = null
      syncInteraction()
      const offset = gesture.end(event)
      if (!offset) return
      void ws.act(() => ws.api.moveNotch({ ...gesture.position(offset), commit: true }).then(() => undefined))
    },
    beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
      if (!ws.state?.notch.bounds) return
      event.stopPropagation()
      resize.current = new PointerGesture(event, ws.state.notch.bounds)
      hold(event)
    },
    updateResize(event: ReactPointerEvent<HTMLButtonElement>) {
      const gesture = resize.current
      const offset = gesture?.move(event)
      if (gesture && offset) void ws.api.resizeNotch({ ...gesture.size(offset), commit: false }).catch(() => {})
    },
    endResize(event: ReactPointerEvent<HTMLButtonElement>) {
      const gesture = resize.current
      if (!gesture?.owns(event)) return
      resize.current = null
      syncInteraction()
      const offset = gesture.end(event)
      if (!offset) return
      void ws.act(() => ws.api.resizeNotch({ ...gesture.size(offset), commit: true }).then(() => undefined))
    },
  }
}

export type NotchPointer = ReturnType<typeof useNotchPointer>
