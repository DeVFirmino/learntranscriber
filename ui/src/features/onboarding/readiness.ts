import { modelReady } from '../model-setup'
import type { PublicState } from '@/bridge/types/state'
import { permissionGrants, permissionNeeds } from './listening-choices'

export interface OnboardingEvidence {
  speechAuthorization?: string
}

// A saved preference is not proof that a credential, model, or operating-system permission exists.
export function onboardingReadiness(state: PublicState, evidence: OnboardingEvidence = {}) {
  const { settings: s, credentials, localModels } = state
  const local = (kind: string) =>
    Boolean(localModels.binaries[kind]) && localModels.models.some((m) => m.kind === kind && m.available)
  const insights = modelReady(state)

  let transcription = false
  if (s.transcriptionProvider === 'apple') transcription = Boolean(s.appleSpeechLocale.trim())
  else if (s.transcriptionProvider === 'local') transcription = local('whisper')
  else if (s.transcriptionProvider === 'custom')
    transcription = Boolean(s.transcriptionBaseUrl.trim() && s.transcriptionModel.trim())
  else transcription = Boolean(credentials[s.transcriptionProvider])

  let audioSource = false
  if (s.onboardingAudioSource === 'microphone') audioSource = Boolean(s.microphoneId.trim())
  if (s.onboardingAudioSource === 'computer' && s.systemAudio) {
    audioSource = ['native', 'process-tap', 'electron', 'input-device'].includes(s.systemAudioSource)
    if (s.systemAudioSource === 'input-device') audioSource = Boolean(s.systemAudioInputDevice.trim())
  }
  const grants = permissionGrants(state, evidence.speechAuthorization)
  const allowed = permissionNeeds(s).every((need) => grants[need])
  return { insights, transcription, audioSource, permissions: audioSource && allowed }
}
