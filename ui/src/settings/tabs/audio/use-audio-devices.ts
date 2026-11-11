import { useEffect, useState } from 'react'
import type { DisplayInfo } from '@/bridge/types/context'
import { useWorkspace } from '@/workspace'
import type { Device } from './audio-sources'

// The audio inputs, followed as devices come and go, the displays, and whether this Mac supports the process tap.
// Devices stay null until the first list arrives.
export function useAudioDevices() {
  const ws = useWorkspace()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [tapSupported, setTapSupported] = useState(false)
  useEffect(() => {
    let current = true
    const load = () =>
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then(
          (list) =>
            current &&
            setDevices(
              list
                .filter((device) => device.kind === 'audioinput')
                .map((device) => ({ deviceId: device.deviceId, label: device.label })),
            ),
        )
        .catch(() => current && setDevices([]))
    load()
    navigator.mediaDevices?.addEventListener?.('devicechange', load)
    void ws.api
      .screens()
      .then((list) => current && setDisplays(list))
      .catch(() => {})
    void ws.api
      .outputStatus()
      .then((status) => current && setTapSupported(status.driver.processTapSupported))
      .catch(() => {})
    return () => {
      current = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', load)
    }
  }, [ws.api])
  const refreshDisplays = () => void ws.api.screens().then(setDisplays)
  return { devices, displays, tapSupported, refreshDisplays }
}
