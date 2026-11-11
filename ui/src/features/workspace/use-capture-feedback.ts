import { useEffect, useState } from 'react'
import type { CaptureState, ContextApi } from '@/bridge/types/context'

export function useCaptureFeedback(api: Pick<ContextApi, 'onCaptureState'>) {
  const [captureState, setCaptureState] = useState<CaptureState | null>(null)
  useEffect(() => api.onCaptureState(setCaptureState), [api])
  useEffect(() => {
    if (!captureState || captureState.phase === 'capturing') return
    const timer = setTimeout(() => setCaptureState(null), captureState.phase === 'error' ? 6000 : 3000)
    return () => clearTimeout(timer)
  }, [captureState])
  return captureState
}
