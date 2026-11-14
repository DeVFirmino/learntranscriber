import type { ListeningNotice } from '@/bridge/types/integrations'
import { toast } from 'sonner'
import { documentT } from '@/i18n'
import { en } from '@/locales/en'

let restart: (() => void) | null = null
let audioSettings: (() => void) | null = null
let report: ((message: string, notice?: ListeningNotice) => boolean | void) | null = null

// The workspace says how to restart the app. A Keychain read macOS refused only recovers after a restart, so that
// error offers it right in the notification and stays up long enough to use it.
export function setRestartAction(action: () => void) {
  restart = action
}

export function setAudioSettingsAction(action: () => void) {
  audioSettings = action
}

// The workspace says where shown errors go besides the toast: main.log, and the floating bar when this window is
// not the one the user is looking at.
export function setErrorReport(action: (message: string, notice?: ListeningNotice) => boolean | void) {
  report = action
}

// A handoff transfers ownership before rendering; the destination presents it without reporting it again.
export function routeFeedback(message: string, notice?: ListeningNotice) {
  return report?.(message, notice) === true
}

function recoveryFor(message: string) {
  const actions = [
    {
      key: 'error.theSelectedMicrophoneIsNotConnected',
      label: 'audio.changeMicrophone',
      run: audioSettings,
      stacked: true,
    },
    { key: 'error.keychainBlocked', label: 'common.restartApp', run: restart, stacked: false },
  ] as const
  return actions.find(({ key, run }) => run && (message === en[key] || message === documentT(key)))
}

// A new failure replaces the previous one rather than stacking repeated clicks in a small floating window. Errors the
// main process sent are already logged there, so they are not reported back.
export function showError(
  message: string,
  action?: { label: string; onClick: () => void },
  { fromMain = false }: { fromMain?: boolean } = {},
) {
  if (!fromMain && routeFeedback(message)) return
  const recovery = action ? undefined : recoveryFor(message)
  const recoveryAction = recovery?.run ? { label: documentT(recovery.label), onClick: recovery.run } : undefined
  toast.error(message, {
    id: 'workspace-error',
    duration: recovery ? 15000 : 3000,
    action: action ?? recoveryAction,
    style: recovery?.stacked ? { flexDirection: 'column', alignItems: 'stretch' } : undefined,
    classNames: recovery?.stacked ? { content: 'pr-6', actionButton: '!m-0 self-start' } : undefined,
    closeButton: true,
  })
}
