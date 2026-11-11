import { useCallback, useEffect, useState } from 'react'
import { useWorkspace } from '@/workspace'
import {
  needsRestart,
  readPermissionsStatus,
  readSpeechStatus,
  type PermissionsStatus,
  type SpeechStatus,
} from './permission-status'

// Reads permission + Apple Speech status on mount and whenever the window regains focus, since granting access
// happens outside the app in System Settings.
export function usePermissionsStatus() {
  const ws = useWorkspace()
  const [status, setStatus] = useState<PermissionsStatus>(() => readPermissionsStatus(ws.state))
  const [speech, setSpeech] = useState<SpeechStatus>({ authorized: false, denied: false })
  const [checking, setChecking] = useState(false)
  const read = useCallback(
    async () => ({
      status: readPermissionsStatus(await ws.api.state()),
      speech: await ws.api.speechCapabilities().then(
        (capabilities) => readSpeechStatus(capabilities.authorization),
        (): SpeechStatus => ({ authorized: false, denied: false }),
      ),
    }),
    [ws.api],
  )
  const apply = useCallback((next: { status: PermissionsStatus; speech: SpeechStatus }) => {
    setStatus(next.status)
    setSpeech(next.speech)
  }, [])
  // Check again shows that it is checking; the reads on showing and on focus update quietly.
  const refresh = useCallback(async () => {
    setChecking(true)
    try {
      apply(await read())
    } finally {
      setChecking(false)
    }
  }, [read, apply])
  useEffect(() => {
    let current = true
    const update = () =>
      void read().then((next) => {
        if (current) apply(next)
      })
    update()
    window.addEventListener('focus', update)
    return () => {
      current = false
      window.removeEventListener('focus', update)
    }
  }, [read, apply])
  return { status, speech, checking, refresh, restartNeeded: needsRestart(status) }
}
