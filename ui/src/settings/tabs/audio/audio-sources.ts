import type { SettingsIconName } from '../../icons/glyphs'

export type Device = { deviceId: string; label: string }

// The microphones a user can pick, by name; the system's default and communications entries are offered separately.
export function microphoneInputs(devices: Device[] | null) {
  return (devices || [])
    .filter((device) => device.deviceId !== 'default' && device.deviceId !== 'communications')
    .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
}

// The incoming source's icon: off, the whole system's audio, the process tap, or an input device.
export function incomingIcon(choice: string): SettingsIconName {
  if (choice === 'none') return 'mic_off'
  if (choice === 'system-audio') return 'desktop_windows'
  if (choice === 'native-tap') return 'hearing'
  return 'mic'
}
