// Pure mapping from the raw IPC state and speech capabilities to the booleans the permission cards render.
export type PermissionsStatus = { microphone: boolean; screen: boolean; accessibility: boolean }
export type SpeechStatus = { authorized: boolean; denied: boolean }

type RawState = { permissions: { microphone: string; screen: string; accessibility?: boolean } } | null | undefined

// Microphone and screen are granted strings, accessibility is a plain boolean.
export function readPermissionsStatus(state: RawState): PermissionsStatus {
  return {
    microphone: state?.permissions.microphone === 'granted',
    screen: state?.permissions.screen === 'granted',
    accessibility: Boolean(state?.permissions.accessibility),
  }
}

// Apple Speech reports its own authorization string; denied and restricted both read as "denied" here.
export function readSpeechStatus(authorization: string): SpeechStatus {
  return {
    authorized: authorization === 'authorized',
    denied: ['denied', 'restricted'].includes(authorization),
  }
}

// A restart is needed while any system permission is still missing.
export function needsRestart(status: PermissionsStatus): boolean {
  return !status.microphone || !status.screen || !status.accessibility
}
