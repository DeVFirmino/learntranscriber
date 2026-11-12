import type { Unsubscribe } from './subscription'

// What the Home banner needs to know: whether a newer release is available and, when it is, the version to show and
// its tag (passed back to skipUpdate). The main process builds the release page itself when openUpdate is called.
export interface UpdateStatus {
  available: boolean
  version?: string
  tagName?: string
  // The in-app download of that release: running with a fraction done (null when the size is unknown), a DMG that
  // matched its published SHA-256, or a failure with its message.
  download?: { phase: 'idle' | 'downloading' | 'ready' | 'failed'; progress: number | null; error: string | null }
}

export interface UpdatesApi {
  updatesState: () => Promise<UpdateStatus>
  // Opens the release page in the default browser; resolves false if nothing is available to open.
  openUpdate: () => Promise<boolean>
  // Downloads the available release's DMG to Downloads and keeps it only if its SHA-256 matches; progress and the
  // result arrive through onUpdatesChange.
  downloadUpdate: () => Promise<UpdateStatus>
  // Opens the verified DMG, where the person drags the app to Applications; false when none is ready.
  installUpdate: () => Promise<boolean>
  // Hides the banner until the next check, at least 24 hours away.
  laterUpdate: () => Promise<UpdateStatus>
  // Never shows this exact tag again.
  skipUpdate: (tagName: string) => Promise<UpdateStatus>
  onUpdatesChange: (listener: (value: UpdateStatus) => void) => Unsubscribe
}
