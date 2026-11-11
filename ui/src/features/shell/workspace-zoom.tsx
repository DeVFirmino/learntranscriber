import { useLayoutEffect, useRef } from 'react'
import { useWorkspace } from '@/workspace'
import { createZoomController } from './zoom-controller'
import { workspaceZoomAction } from './zoom-level'

export function WorkspaceZoom() {
  const { state, api, act } = useWorkspace()
  const level = state?.settings.workspaceZoom
  const controller = useRef<ReturnType<typeof createZoomController> | null>(null)
  useLayoutEffect(() => {
    const zoom = createZoomController({
      apply: (value) => {
        document.documentElement.style.zoom = String(value / 100)
        document.documentElement.style.setProperty('--workspace-zoom', String(value / 100))
      },
      save: (value) => api.settings({ workspaceZoom: value }),
      failed: (error) =>
        void act(async () => {
          throw error
        }),
    })
    controller.current = zoom
    const onKeyDown = (event: KeyboardEvent) => {
      const action = workspaceZoomAction(event)
      if (!action || event.isComposing || event.defaultPrevented) return
      event.preventDefault()
      void zoom.change(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      zoom.dispose()
      window.removeEventListener('keydown', onKeyDown)
      document.documentElement.style.removeProperty('zoom')
      document.documentElement.style.removeProperty('--workspace-zoom')
    }
  }, [api, act])
  useLayoutEffect(() => {
    if (level !== undefined) controller.current?.sync(level)
  }, [level])
  return null
}
