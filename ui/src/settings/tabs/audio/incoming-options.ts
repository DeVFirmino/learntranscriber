import { INPUT } from '../../../audio/incoming-choice'
import type { Device } from './audio-sources'

export type IncomingOption =
  | { value: string; kind: 'none' | 'system-audio' | 'native-tap' | 'default-input' }
  | { value: string; kind: 'input'; device: Device }

// The sources Incoming Audio offers, in two groups: the system routes (off, the system's audio, and the process tap
// where this Mac supports it or it is already chosen), then the default input and every named input.
export function incomingOptions({
  choice,
  inputs,
  tapSupported,
}: {
  choice: string
  inputs: Device[]
  tapSupported: boolean
}) {
  const system: IncomingOption[] = [
    { value: 'none', kind: 'none' },
    { value: 'system-audio', kind: 'system-audio' },
  ]
  if (tapSupported || choice === 'native-tap') system.push({ value: 'native-tap', kind: 'native-tap' })
  const devices: IncomingOption[] = [
    { value: `${INPUT}default`, kind: 'default-input' },
    ...inputs.map((device) => ({ value: INPUT + device.deviceId, kind: 'input' as const, device })),
  ]
  return { system, devices }
}
