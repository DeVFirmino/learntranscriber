import type { WorkspaceApi } from '@/bridge/types/api'
import type { PermissionNeed } from '../onboarding/listening-choices'
import { missingListeningPermission } from './listening-permission'

// Preserve the original capture diagnostic while presenting the first missing permission through onboarding's flow.
export function createCaptureErrorReporter({
  api,
  blocked,
  failure,
}: {
  api: Pick<WorkspaceApi, 'state' | 'speechCapabilities' | 'systemAudioStatus'>
  blocked(permission: PermissionNeed, diagnostic: string): void
  failure(message: string): void
}) {
  return async (message: string) => {
    const permission = await api
      .state()
      .then((state) => missingListeningPermission(api, state))
      .catch(() => undefined)
    if (permission) blocked(permission, message)
    else failure(message)
  }
}
