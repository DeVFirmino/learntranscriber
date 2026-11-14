import type { WorkspaceApi } from '@/bridge/types/api'
import type { PublicState } from '@/bridge/types/state'
import { permissionGrants, permissionNeeds, type PermissionNeed } from '../onboarding/listening-choices'

// The helper checks its own ScreenCaptureKit grant; a grant for the parent app alone does not prove it can capture.
export async function missingListeningPermission(
  api: Pick<WorkspaceApi, 'speechCapabilities' | 'systemAudioStatus'>,
  state: PublicState,
): Promise<PermissionNeed | undefined> {
  const needs = permissionNeeds({
    ...state.settings,
    onboardingAudioSource: state.settings.onboardingAudioSource || 'microphone',
  })
  const speech = needs.includes('speech') ? await api.speechCapabilities().catch(() => null) : null
  const native =
    needs.includes('screen') && ['native', 'process-tap'].includes(state.settings.systemAudioSource)
      ? await api.systemAudioStatus().catch(() => null)
      : null
  const grants = permissionGrants(state, speech?.authorization)
  if (!speech) grants.speech = true
  if (native && typeof native === 'object' && 'permissionGranted' in native && native.permissionGranted === false)
    grants.screen = false
  return needs.find((need) => !grants[need])
}
