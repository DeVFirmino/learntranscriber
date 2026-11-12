import { createMockWorkspace } from './mock'
import type { WorkspaceApi } from './types/api'

export type BridgeMode = 'native' | 'mock'

export interface Bridge {
  api: WorkspaceApi
  mode: BridgeMode
}

export function createWorkspace(): Bridge {
  const native = window.workspace
  if (native) return { api: native, mode: 'native' }
  const url = new URL(window.location.href)
  if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return { api: createMockWorkspace(), mode: 'mock' }
  }
  throw new Error('The native workspace bridge is unavailable. Open the Mac app, or use the local browser preview.')
}

// Logs an error raised outside the workspace, such as a window that failed to render. The browser preview has no log.
export function reportUnhandled(message: string) {
  void window.workspace?.reportError({ message, forward: false }).catch(() => undefined)
}
