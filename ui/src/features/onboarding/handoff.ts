import type { WorkspaceApi } from '@/bridge/types/api'
import { onboardingProgress } from './progress'

type HandoffApi = Pick<
  WorkspaceApi,
  'state' | 'speechCapabilities' | 'settings' | 'expandOverlay' | 'showOverlay' | 'presentOnboarding'
>

// Re-read the bridge at completion: the permissions or provider may have changed while the example was playing. A
// ready setup completes the onboarding and turns on the guide that coaches the first real session.
export async function finishOnboarding({ api, floating }: { api: HandoffApi; floating: boolean }) {
  const state = await api.state()
  let speechAuthorization: string | undefined
  if (state.settings.transcriptionProvider === 'apple') {
    try {
      speechAuthorization = (await api.speechCapabilities()).authorization
    } catch {
      speechAuthorization = undefined
    }
  }
  const progress = onboardingProgress(state, { speechAuthorization })
  await api.settings({
    onboardingCompleted: progress.configurationReady,
    onboardingGuide: progress.configurationReady,
    onboardingDismissed: true,
  })
  await api.presentOnboarding(false)
  if (floating) await api.expandOverlay(false)
  await api.showOverlay()
}
