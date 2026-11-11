import { MODEL_NOT_READY } from '../model-setup'
import { showError } from './error-toast'
import type { WorkspaceApi } from '@/bridge/types/api'
import { errorMessage } from '@/format'
import { documentT } from '@/i18n'

// Setup errors come with a button to the place that fixes them.
const SETUP_ERRORS = new Set([
  MODEL_NOT_READY,
  'Choose an assistant model in AI sources.',
  'Add a provider key in AI sources.',
  'Add a provider key first.',
  'Continue with ChatGPT in AI sources first.',
])

// Errors reach the user as a toast. `act` runs an action and reports what it throws.
export function errorReporter(api: Pick<WorkspaceApi, 'openAiSources'>) {
  const openAiSources = () => void api.openAiSources().catch((error: unknown) => showError(errorMessage(error)))
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    const setup = SETUP_ERRORS.has(message)
    showError(errorMessage(error), setup ? { label: documentT('setup.connectAI'), onClick: openAiSources } : undefined)
  }
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (error) {
      report(error)
    }
  }
  return { openAiSources, report, act }
}
