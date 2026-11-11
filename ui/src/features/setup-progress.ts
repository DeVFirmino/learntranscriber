import type { PublicState } from '@/bridge/types/state'
import type { MessageKey } from '@/i18n'
import { setupReadiness } from './setup-readiness'

export type SetupStepKey = 'model' | 'audio' | 'assistant'
export interface SetupStep {
  key: SetupStepKey
  ready: boolean
  route: string
}
export interface SetupProgress {
  steps: SetupStep[]
  completed: number
  remaining: number
  complete: boolean
  next: SetupStep | null
}

export const SETUP_STEP_LABELS: Record<SetupStepKey, MessageKey> = {
  model: 'onboarding.model',
  audio: 'onboarding.audio',
  assistant: 'onboarding.assistant',
}

// The configuration steps in the order a first session needs them, each with the page that finishes it.
export function setupProgress(state: PublicState): SetupProgress {
  const ready = setupReadiness(state)
  const audioRoute = state.permissions.microphone === 'granted' ? '#settings/general' : '#settings/permissions'
  const steps: SetupStep[] = [
    { key: 'model', ready: ready.model, route: '#settings/ai/sources' },
    { key: 'audio', ready: ready.audio, route: audioRoute },
    { key: 'assistant', ready: ready.assistant, route: '#assistants/choose' },
  ]
  const completed = steps.filter((step) => step.ready).length
  return {
    steps,
    completed,
    remaining: steps.length - completed,
    complete: completed === steps.length,
    next: steps.find((step) => !step.ready) ?? null,
  }
}
