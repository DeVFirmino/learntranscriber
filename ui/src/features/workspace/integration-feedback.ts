import type { WorkspaceApi } from '@/bridge/types/api'
import type { IntegrationFeedback } from '@/bridge/types/integrations'
import { localizeMessage } from '@/format'
import { showError } from './error-toast'
import { showListeningHint } from './listening-hint'

// Only the destination renderer presents transferred feedback; it never forwards it back to main.
export function showIntegrationFeedback(api: Pick<WorkspaceApi, 'openPrivacyPane'>, feedback: IntegrationFeedback) {
  if (typeof feedback === 'string') showError(localizeMessage(feedback), undefined, { fromMain: true })
  else showListeningHint(api, feedback.notice.permission, { fromMain: true })
}
