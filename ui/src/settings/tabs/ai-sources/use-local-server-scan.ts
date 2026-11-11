import { useState } from 'react'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { showError } from '@/features/workspace/error-toast'

export type ServerName = 'Ollama' | 'LM Studio'
export type ScanStatus = 'scanning' | 'found' | 'not_found' | null

const SCAN_TARGETS = { Ollama: 'ollama', 'LM Studio': 'lmstudio' } as const

// Looks for a running Ollama or LM Studio server. A found server becomes the custom endpoint and its page opens; a
// missing one is reported for three seconds.
export function useLocalServerScan(openCustom: () => void) {
  const ws = useWorkspace()
  const [scan, setScan] = useState<Record<string, ScanStatus>>({})
  const mark = (name: ServerName, status: ScanStatus) => setScan((value) => ({ ...value, [name]: status }))
  const scanFor = (name: ServerName) =>
    void (async () => {
      mark(name, 'scanning')
      try {
        const server = (await ws.api.discoverLocalServers()).find(
          (item) => item.id === SCAN_TARGETS[name] && item.available,
        )
        if (!server) {
          mark(name, 'not_found')
          window.setTimeout(() => mark(name, null), 3000)
          return
        }
        mark(name, 'found')
        await ws.api.settings({ customBaseUrl: server.endpoint })
        window.setTimeout(() => {
          mark(name, null)
          openCustom()
        }, 800)
      } catch (error) {
        mark(name, 'not_found')
        showError(errorMessage(error))
      }
    })()
  return { status: (name: ServerName) => scan[name] || null, scanFor }
}
