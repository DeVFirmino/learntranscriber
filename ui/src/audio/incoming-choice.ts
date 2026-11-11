import type { Settings } from '@/bridge/types/settings'

export type Incoming = Pick<Settings, 'systemAudio' | 'systemAudioSource' | 'systemAudioInputDevice'>

export const INPUT = 'input:'

// The Output (They) choices: none, the display's system audio, the native tap of the default output when
// this Mac supports it, and the input devices. ScreenCaptureKit stays the tap's internal fallback, so a saved
// `native` route is shown as the tap choice.
export function incomingChoice(settings: Incoming) {
  if (!settings.systemAudio) return 'none'
  if (settings.systemAudioSource === 'electron' || settings.systemAudioSource === 'native') return 'system-audio'
  if (settings.systemAudioSource === 'input-device') return INPUT + (settings.systemAudioInputDevice || '')
  return 'native-tap'
}

export function incomingSettings(choice: string, current: Incoming): Incoming {
  if (choice === 'none') return { ...current, systemAudio: false }
  if (choice === 'system-audio') return { ...current, systemAudio: true, systemAudioSource: 'native' }
  if (choice === 'native-tap') return { ...current, systemAudio: true, systemAudioSource: 'process-tap' }
  return { systemAudio: true, systemAudioSource: 'input-device', systemAudioInputDevice: choice.slice(INPUT.length) }
}
