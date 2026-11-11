import { useEffect, useState } from 'react'
import { useLatest } from './use-latest'
import type { WorkspaceEvents } from './use-workspace-events'
import { readOverlay, readRoute, readWindowRole } from './window-location'

// The page this window shows and whether it is an overlay window, following navigation. A new page starts at the top.
export function useWindowLocation() {
  const [route, setRoute] = useState(readRoute)
  const [overlay, setOverlay] = useState(readOverlay)
  const routeRef = useLatest(route)
  const overlayRef = useLatest(overlay)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])
  const events: Pick<WorkspaceEvents, 'route' | 'windowRole'> = {
    route: () => setRoute(readRoute()),
    windowRole: () => setOverlay(readOverlay()),
  }
  const go = (next: string) => {
    window.location.hash = next
  }
  return { route, overlay, routeRef, overlayRef, windowRole: readWindowRole(), events, go }
}
