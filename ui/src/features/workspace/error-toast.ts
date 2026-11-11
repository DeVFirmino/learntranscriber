import { toast } from 'sonner'
import { documentT } from '@/i18n'
import { en } from '@/locales/en'

let restart: (() => void) | null = null
let report: ((message: string) => void) | null = null

// The workspace says how to restart the app. A Keychain read macOS refused only recovers after a restart, so that
// error offers it right in the notification and stays up long enough to use it.
export function setRestartAction(action: () => void) {
  restart = action
}

// The workspace says where shown errors go besides the toast: main.log, and the floating bar when this window is
// not the one the user is looking at.
export function setErrorReport(action: (message: string) => void) {
  report = action
}

function keychainBlocked(message: string) {
  return message === en['error.keychainBlocked'] || message === documentT('error.keychainBlocked')
}

// A new failure replaces the previous one rather than stacking repeated clicks in a small floating window. Errors the
// main process sent are already logged there, so they are not reported back.
export function showError(
  message: string,
  action?: { label: string; onClick: () => void },
  { fromMain = false }: { fromMain?: boolean } = {},
) {
  const restartAction =
    !action && restart && keychainBlocked(message) ? { label: documentT('common.restartApp'), onClick: restart } : null
  toast.error(message, {
    id: 'workspace-error',
    duration: restartAction ? 15000 : 3000,
    action: restartAction ?? action,
    closeButton: true,
  })
  if (!fromMain) report?.(message)
}
