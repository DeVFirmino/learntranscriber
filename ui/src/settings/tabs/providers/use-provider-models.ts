import { useEffect, useState } from 'react'
import { useWorkspace } from '@/workspace'

// The model ids a provider offers, loaded once it is enabled (signed in or keyed).
export function useProviderModels(provider: string, enabled: boolean) {
  const ws = useWorkspace()
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    if (!enabled) return
    let current = true
    void ws.api
      .models(provider)
      .then((ids) => current && setModels(ids))
      .catch(() => current && setModels([]))
    return () => {
      current = false
    }
  }, [ws.api, provider, enabled])
  return models
}
