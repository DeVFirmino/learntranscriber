import type { Unsubscribe } from './subscription'

// What the Home banner needs to know: whether a newer release is available and, when it is, the version to show,
// its tag (passed back to skipUpdate) and the release page to open.
export interface UpdateStatus {
  available: boolean
  version?: string
  tagName?: string
  url?: string
}

export interface UpdatesApi {
  updatesState: () => Promise<UpdateStatus>
  // Opens the release page in the default browser; resolves false if nothing is available to open.
  openUpdate: () => Promise<boolean>
  // Hides the banner until the next check, at least 24 hours away.
  laterUpdate: () => Promise<UpdateStatus>
  // Never shows this exact tag again.
  skipUpdate: (tagName: string) => Promise<UpdateStatus>
  onUpdatesChange: (listener: (value: UpdateStatus) => void) => Unsubscribe
}
