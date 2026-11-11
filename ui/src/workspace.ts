import { createContext, useContext } from 'react'
import type { CaptureState } from '@/bridge/types/context'
import type { AudioCapture } from '@/audio/capture'
import type { createWorkspace } from '@/bridge'
import type { AssistantDraft } from '@/bridge/types/assistants'
import type { SessionDetail } from '@/bridge/types/sessions'
import type { PublicState } from '@/bridge/types/state'
import type { PendingImage } from '@/features/workspace/attachments'

export interface TextContext {
  text: string
  sessionId: string
  label: string
}

export type DialogRequest =
  | {
      type: 'assistant'
      id?: string
      category?: string
      draft?: AssistantDraft
      systemPromptOnly?: boolean
      reviewSource?: string
    }
  | { type: 'assistant-import' }
  | { type: 'assistant-delete'; id: string }
  | { type: 'session-rename'; id: string; title: string }
  | { type: 'session-delete'; ids: string[]; title?: string }
  | null

export interface WorkspaceData {
  state: PublicState | null
  loadError: string | null
  route: string
  overlay: boolean
  windowRole: string
  recordingReminder: boolean
  session: SessionDetail | null
  sessionTab: 'transcript' | 'summary' | 'translation'
  query: string
  captureState: CaptureState | null
  pendingImages: PendingImage[]
  pendingText: TextContext | null
  requestId: string | null
  // Changes whenever the audio capture does, so readers of `audio` see its current state.
  audioRev: number
  dialog: DialogRequest
}

// The bridge, the audio capture and every action: the same objects for the whole life of the window.
export interface WorkspaceActions {
  mode: 'native' | 'mock'
  api: ReturnType<typeof createWorkspace>['api']
  audio: AudioCapture
  continueRecording: () => void
  toggleListening: () => Promise<void>
  captureScreen: () => Promise<void>
  setSessionTab: (tab: 'transcript' | 'summary' | 'translation') => void
  setDialog: (dialog: DialogRequest) => void
  go: (route: string) => void
  search: (query: string) => Promise<void>
  act: (fn: () => Promise<void>) => Promise<void>
  openAiSources: () => void
  openSession: (id: string) => Promise<void>
  ensureSession: () => Promise<void>
  startFloatingSession: () => Promise<void>
  refreshSession: () => Promise<void>
  addPendingImage: (value: string) => void
  removePendingImage: (id: string) => void
  setPendingText: (value: TextContext | null) => void
  patchPendingText: (text: string) => void
  runGeneration: (mode: string, question?: string, image?: string) => Promise<void>
  setDictating: (value: boolean) => void
}

export type WorkspaceValue = WorkspaceData & WorkspaceActions

// What is being said and answered right now. It changes on every caption and streamed word, so it has its own
// context: only the few components that show it re-render that often.
export interface LiveWorkspace {
  liveCaptions: Record<string, string>
  answer: string
  pendingQuestion: string
  overlayMode?: string
  overlaySessionId?: string
  overlayOutcome: 'idle' | 'running' | 'saved' | 'interrupted' | 'error' | 'cancelled'
  overlayErrorCode?: 'generationFailed' | 'timeout'
  overlayAnswer: string
  overlayStreaming: boolean
  overlayResponseId: string
  overlayStartedAt: string
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)
export const LiveWorkspaceContext = createContext<LiveWorkspace | null>(null)

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('Workspace is not available.')
  return value
}

export function useWorkspaceLive() {
  const value = useContext(LiveWorkspaceContext)
  if (!value) throw new Error('Workspace is not available.')
  return value
}
