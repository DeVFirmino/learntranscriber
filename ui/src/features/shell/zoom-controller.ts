import { nextWorkspaceZoom, type ZoomAction } from './zoom-level'

export function createZoomController({
  apply,
  save,
  failed,
}: {
  apply: (level: number) => void
  save: (level: number) => Promise<unknown>
  failed: (error: unknown) => void
}) {
  let level = 100
  let saved = 100
  let pending = 0
  let disposed = false
  let ready = false
  let queue = Promise.resolve()
  return {
    sync(value: number) {
      if (pending || disposed) return
      level = saved = value
      ready = true
      apply(level)
    },
    change(action: ZoomAction) {
      if (disposed || !ready) return queue
      const next = nextWorkspaceZoom(level, action)
      if (next === level) return queue
      level = next
      apply(level)
      pending++
      queue = queue.then(async () => {
        try {
          await save(next)
          saved = next
        } catch (error) {
          if (!disposed) failed(error)
        } finally {
          pending--
          if (!pending && !disposed) {
            level = saved
            apply(level)
          }
        }
      })
      return queue
    },
    dispose() {
      disposed = true
    },
  }
}
