import { useCallback, useEffect, useState } from 'react'
import type { SpeechAssets } from '@/bridge/types/audio'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import type { Capabilities } from './speech-locales'

// Apple Speech on this Mac: its permission and language, the languages macOS offers, and installing or releasing
// one. Every change reloads both; a failure is kept until dismissed.
export function useSpeechAssets() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [assets, setAssets] = useState<SpeechAssets | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState('')
  const [releasing, setReleasing] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(
    () => Promise.all([ws.api.speechCapabilities().catch(() => null), ws.api.speechAssets().catch(() => null)]),
    [ws.api],
  )
  const apply = useCallback(([nextCapabilities, nextAssets]: Awaited<ReturnType<typeof load>>) => {
    setCapabilities(nextCapabilities)
    setAssets(nextAssets)
    setLoading(false)
  }, [])
  const refresh = useCallback(async () => apply(await load()), [load, apply])
  // The first read arrives after the screen shows; one that lands after leaving it is dropped.
  useEffect(() => {
    let current = true
    void load().then((next) => {
      if (current) apply(next)
    })
    return () => {
      current = false
    }
  }, [load, apply])
  const install = (locale: string) =>
    void (async () => {
      setError('')
      setInstalling(locale)
      try {
        const result = await ws.api.manageSpeechLocale({ operation: 'install', locale })
        if (result.assetManagementAvailable === false)
          throw new Error(st('settings.api.localModels.appleSpeechAssetUnavailable'))
      } catch (failure) {
        setError(errorMessage(failure))
      } finally {
        setInstalling('')
        await refresh()
      }
    })()
  const release = (locale: string) =>
    void (async () => {
      setError('')
      setReleasing(locale)
      try {
        await ws.api.manageSpeechLocale({ operation: 'release', locale })
      } catch (failure) {
        setError(errorMessage(failure))
      } finally {
        setReleasing('')
        await refresh()
      }
    })()
  // macOS asks for Speech Recognition when the app first transcribes with Apple Speech; until then this opens the
  // Speech Recognition pane, like the Permissions tab.
  const grant = () =>
    void (async () => {
      await ws.api.openPrivacyPane('speech')
      await refresh()
    })()
  return {
    capabilities,
    assets,
    loading,
    installing,
    releasing,
    error,
    dismissError: () => setError(''),
    install,
    release,
    grant,
    openSettings: () => void ws.api.openPrivacyPane('speech'),
  }
}
