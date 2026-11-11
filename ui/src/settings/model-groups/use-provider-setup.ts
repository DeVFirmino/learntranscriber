import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Settings } from '@/bridge/types/settings'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../use-settings-t'
import type { Card, Group, ProviderSetup } from './cards'

// What the configured providers offer, for the Models tab and any other model chooser: the account and server model
// lists load once per configured provider, and a list that fails keeps the reason. Null until the workspace state
// arrives.
export function useProviderSetup(): ProviderSetup | null {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [available, setAvailable] = useState<Record<string, string[]>>({})
  const [rejected, setRejected] = useState<Record<string, string>>({})
  const state = ws.state
  const settings = state?.settings
  const signedIn = Boolean(
    state?.chatgpt.accounts.some((account) => account.id === state.chatgpt.activeId && account.authenticated),
  )
  const keys = state?.credentials || {}
  const hasCustom = Boolean((settings?.customBaseUrl || '').trim())
  useEffect(() => {
    let current = true
    const wanted = [signedIn && 'chatgpt', keys.openai && 'openai', hasCustom && 'custom'].filter(Boolean) as string[]
    for (const provider of wanted)
      void ws.api
        .models(provider)
        .then((ids) => {
          if (!current) return
          setAvailable((value) => ({ ...value, [provider]: ids }))
          setRejected((value) => {
            const next = { ...value }
            delete next[provider]
            return next
          })
        })
        .catch((error: unknown) => {
          if (!current) return
          setAvailable((value) => ({ ...value, [provider]: [] }))
          setRejected((value) => ({ ...value, [provider]: errorMessage(error) }))
        })
    return () => {
      current = false
    }
  }, [ws.api, signedIn, keys.openai, hasCustom])
  const localLlm = useMemo(
    () => (state?.localModels.models || []).filter((model) => model.kind === 'llm' && model.available),
    [state?.localModels.models],
  )
  const localWhisper = useMemo(
    () => (state?.localModels.models || []).filter((model) => model.kind === 'whisper' && model.available),
    [state?.localModels.models],
  )
  if (!state || !settings) return null
  return {
    settings,
    signedIn,
    keys,
    available,
    rejected,
    localLlm,
    localWhisper,
    llmRuntime: state.localModels.runtimes.llm?.modelId,
    whisperRuntime: state.localModels.runtimes.whisper?.modelId,
    platform: state.privacy.platform,
    st,
  }
}

// Saves a model card's choice; a local model card also makes that model the one the local server runs.
export function useChooseModel() {
  const ws = useWorkspace()
  return useCallback(
    (groups: Group[], patch: Partial<Settings>, model: Card) =>
      void ws.act(async () => {
        await ws.api.settings(patch)
        const local = groups.find((item) => item.models.includes(model))?.local?.(model)
        if (local) await ws.api.startLocalModel(local)
      }),
    [ws],
  )
}
