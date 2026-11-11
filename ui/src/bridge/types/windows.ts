import type { Unsubscribe } from './subscription'

export interface WindowsApi {
  openQuestion: (question: string) => Promise<boolean>
  onQuestionDraft: (listener: (question: string) => void) => Unsubscribe
  presentOnboarding: (active: boolean) => Promise<boolean>
  expandNotch: (expanded: boolean) => Promise<boolean>
  setNotchInteractive: (active: boolean) => Promise<boolean>
  displayNotchInsight: (id: string) => Promise<boolean>
  moveNotch: (input: {
    x: number
    y: number
    commit: boolean
  }) => Promise<{ x: number; y: number; width: number; height: number }>
  resizeNotch: (input: {
    width: number
    height: number
    commit: boolean
  }) => Promise<{ x: number; y: number; width: number; height: number }>
  openAiModels: () => Promise<boolean>
  openAiSources: () => Promise<boolean>
  openAudioSources: () => Promise<boolean>
  showMain: () => Promise<boolean>
  resizeOverlay: (size: { width: number; height: number }) => Promise<boolean>
  hide: () => Promise<unknown>
  restore: () => Promise<unknown>
  showOverlay: (expanded?: boolean) => Promise<boolean>
  toggleOverlay: () => Promise<boolean>
  setBarPopoverOpen: (open: boolean) => Promise<boolean>
  expandOverlay: (expanded: boolean) => Promise<boolean>
  closeOverlay: () => Promise<boolean>
}
