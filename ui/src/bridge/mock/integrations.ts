import type { IntegrationsApi } from '../types/integrations'
import type { MockContext } from './state'
import { chatgptLoginApi } from './chatgpt-login'

// Everything the native app's integrations surface would reach: ChatGPT accounts and the error channel integrations
// publish to.
export function integrationsApi(ctx: MockContext) {
  const api: IntegrationsApi = {
    ...chatgptLoginApi(ctx),
    onIntegrationError: ctx.integrationErrors.subscribe,
    reportError: async () => true,
  }
  return api
}
