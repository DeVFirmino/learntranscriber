import { toast } from 'sonner'
import type { WorkspaceApi } from '@/bridge/types/api'
import { documentT, type MessageKey } from '@/i18n'
import type { PermissionNeed } from '../onboarding/listening-choices'
import { errorMessage } from '@/format'
import { showError } from './error-toast'

const LABELS: Record<PermissionNeed, MessageKey> = {
  microphone: 'onboardingFlow.permissionMicrophone',
  screen: 'onboardingFlow.permissionScreen',
  speech: 'onboardingFlow.permissionSpeech',
}

// Reuse the onboarding permission names and the existing, allowlisted System Settings IPC action.
export function showListeningHint(api: Pick<WorkspaceApi, 'openPrivacyPane'>, permission?: PermissionNeed) {
  toast.message(
    permission
      ? documentT('analysis.permissionMissing', { permission: documentT(LABELS[permission]) })
      : documentT('analysis.nothingHeard'),
    {
      id: 'listening-hint',
      duration: permission ? 15000 : 8000,
      closeButton: true,
      style: { flexDirection: 'column', alignItems: 'stretch' },
      classNames: { content: 'pr-6', actionButton: '!m-0 self-start' },
      action: permission
        ? {
            label: documentT('analysis.openSettings'),
            onClick: () =>
              void api.openPrivacyPane(permission).catch((error: unknown) => showError(errorMessage(error))),
          }
        : undefined,
    },
  )
}
