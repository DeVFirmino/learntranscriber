import { useEffect, useState } from 'react'
import type { WindowsApi } from '../../bridge/types/windows'
import { useHeldCommand } from './use-held-command'

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// Whether the bar shows its shortcut sheet, while Command is held or after the bar's shortcut key was clicked. The bar
// window first grows upward, then the sheet appears; closing gives the room back.
export function useShortcutSheet(api: Pick<WindowsApi, 'setBarPopoverOpen'>) {
  const held = useHeldCommand()
  const [pinned, setPinned] = useState(false)
  const [open, setOpen] = useState(false)
  const wanted = held || pinned
  // Letting go closes the sheet in the same render; opening waits for the native popover below.
  if (!wanted && open) setOpen(false)
  useEffect(() => {
    let current = true
    if (!wanted) {
      void api.setBarPopoverOpen(false).catch(() => {})
      return
    }
    void (async () => {
      await api.setBarPopoverOpen(true)
      await nextFrame()
      if (current) setOpen(true)
    })().catch(() => {})
    return () => {
      current = false
    }
  }, [api, wanted])
  return { open, pinned, setPinned }
}
