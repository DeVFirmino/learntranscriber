import type { PublicState } from '@/bridge/types/state'
import type { SessionDetail } from '@/bridge/types/sessions'
import { isSilentAnswer } from '../overlay/silent-answer'
import { onboardingReadiness, type OnboardingEvidence } from './readiness'

export type OnboardingStep =
  'welcome' | 'insights' | 'transcription' | 'audioSource' | 'permissions' | 'demo' | 'finish'

// The five parts the person sees in the header: welcome, AI, listening, permissions, and the first try.
const GUIDE: Record<OnboardingStep, number> = {
  welcome: 1,
  insights: 2,
  transcription: 3,
  audioSource: 3,
  permissions: 4,
  demo: 5,
  finish: 5,
}
export const GUIDE_STEPS = 5

export function guideStep(step: OnboardingStep) {
  return GUIDE[step]
}

// What a real session has produced so far. Demo milestones never count: only this session's own entries do.
export function sessionMilestones(session?: SessionDetail | null) {
  const entries = session?.entries.filter((entry) => entry.session_id === session.id) ?? []
  return {
    transcript: entries.some((entry) => entry.kind === 'transcript' && Boolean(entry.content.trim())),
    answer: entries.some((entry) => entry.kind === 'assistant' && !isSilentAnswer(entry.content)),
  }
}

export function hasUsefulSession(session?: SessionDetail | null) {
  const { transcript, answer } = sessionMilestones(session)
  return transcript && answer
}

export function onboardingProgress(
  state: PublicState,
  evidence: OnboardingEvidence = {},
  session?: SessionDetail | null,
) {
  const readiness = onboardingReadiness(state, evidence)
  const configurationReady = Object.values(readiness).every(Boolean)
  const steps = [
    { key: 'insights' as const, ready: readiness.insights },
    { key: 'transcription' as const, ready: readiness.transcription },
    { key: 'audioSource' as const, ready: readiness.audioSource },
    { key: 'permissions' as const, ready: readiness.permissions },
    // The sample conversation stands in only while the real setup is missing; a ready setup tries it for real.
    { key: 'demo' as const, ready: state.settings.onboardingDemoSeen || configurationReady },
  ]
  const next: OnboardingStep = steps.find((step) => !step.ready)?.key ?? 'finish'
  let current: OnboardingStep = next
  if (!state.settings.onboardingStarted) current = 'welcome'
  return {
    steps,
    current,
    next,
    configurationReady,
    demoSeen: state.settings.onboardingDemoSeen,
    completed: configurationReady && state.settings.onboardingCompleted,
    firstUsefulSession: hasUsefulSession(session),
  }
}

// Every profile that has neither closed nor finished the onboarding sees it, including one updated from a version
// without it. Never interrupt a live session; dismissal suppresses automatic presentation, not access to unfinished
// setup.
export function shouldPresentOnboarding(state: PublicState) {
  return (
    !state.settings.onboardingDismissed &&
    !state.settings.onboardingCompleted &&
    !state.privacy.concealed &&
    !state.activeSessionId &&
    !state.overlay.listening?.active &&
    !state.overlay.listening?.starting
  )
}
