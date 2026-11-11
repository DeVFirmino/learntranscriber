import type { PublicState } from '@/bridge/types/state'

export type AudioChoice = 'computer' | 'microphone'
export type TranscriptionChoice = 'apple' | 'openai' | 'gemini'
export type PermissionNeed = 'microphone' | 'screen' | 'speech'

type Settings = PublicState['settings']
type NeedsInput = Pick<
  Settings,
  'onboardingAudioSource' | 'systemAudio' | 'systemAudioSource' | 'transcriptionProvider'
>

// Choosing browser or meeting audio turns incoming audio on; a granted permission alone never picks a source.
export function audioSourcePatch(choice: AudioChoice): Partial<Settings> {
  if (choice === 'computer') return { onboardingAudioSource: 'computer', systemAudio: true }
  return { onboardingAudioSource: 'microphone', systemAudio: false }
}

// What the listening step picks on its first visit: the computer's audio as well as the microphone, since the app is
// mostly used for meetings, videos and lectures, and Apple Speech, which runs on this Mac with no key and no cost.
// A step the person already visited keeps their choices.
export function listeningDefaults(settings: Pick<Settings, 'onboardingAudioSource'>): Partial<Settings> {
  if (settings.onboardingAudioSource) return {}
  return { ...audioSourcePatch('computer'), transcriptionProvider: 'apple' }
}

// The macOS access the chosen audio and speech to text need, in the order the permissions step asks for them. A
// loopback input device is a microphone to macOS, so it needs microphone access instead of screen access.
export function permissionNeeds(settings: NeedsInput): PermissionNeed[] {
  const needs: PermissionNeed[] = []
  // RecordingPipeline always opens the microphone alongside incoming audio.
  if (settings.onboardingAudioSource) needs.push('microphone')
  if (settings.systemAudio && settings.systemAudioSource !== 'input-device') needs.push('screen')
  if (settings.transcriptionProvider === 'apple') needs.push('speech')
  return needs
}

export function permissionGrants(state: Pick<PublicState, 'permissions'>, speechAuthorization?: string) {
  return {
    microphone: state.permissions.microphone === 'granted',
    screen: state.permissions.screen === 'granted',
    speech: speechAuthorization === 'authorized',
  } satisfies Record<PermissionNeed, boolean>
}

// Speech to text through an API needs that provider's key in the app; Apple Speech runs on this Mac.
export function transcriptionKeyMissing(state: Pick<PublicState, 'settings' | 'credentials'>) {
  const provider = state.settings.transcriptionProvider
  return (provider === 'openai' || provider === 'gemini') && !state.credentials[provider]
}
