import type { Unsubscribe } from './subscription'

export interface AppApi {
  dispatchShortcut: (action: string) => Promise<boolean>
  onAction: (listener: (action: string) => void) => Unsubscribe
  onPrepareQuit: (listener: () => void) => Unsubscribe
  quitReady: (input?: { discardedSegments: number }) => Promise<boolean>
  appVersion: () => Promise<string>
  // Quits through the ordered shutdown and opens the app again.
  relaunchApp: () => Promise<unknown>
  requestMicrophone: () => Promise<boolean>
  openPrivacyPane: (name: 'microphone' | 'screen' | 'accessibility' | 'speech') => Promise<unknown>
  sharingHelp: () => Promise<unknown>
}
