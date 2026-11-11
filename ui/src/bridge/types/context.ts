import type { Unsubscribe } from './subscription'

export interface SelectionValue {
  text: string
  sessionId: string
  application?: string
}

export interface DisplayInfo {
  id: string
  label: string
}

export interface CaptureState {
  phase: 'capturing' | 'captured' | 'error'
}

export interface ContextApi {
  contextStatus: () => Promise<{ trusted: boolean }>
  contextPermission: () => Promise<unknown>
  selectedText: () => Promise<SelectionValue>
  screenText: () => Promise<SelectionValue>
  onSelection: (listener: (value: SelectionValue) => void) => Unsubscribe
  clipboard: () => Promise<string>
  clipboardImage: () => Promise<string | null>
  screens: () => Promise<DisplayInfo[]>
  capture: () => Promise<string>
  onCaptureState: (listener: (value: CaptureState) => void) => Unsubscribe
}
