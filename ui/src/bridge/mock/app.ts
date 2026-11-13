import type { AppApi } from '../types/app'
import type { MockContext } from './state'

export function appApi(ctx: MockContext) {
  const { actions } = ctx
  const api: AppApi = {
    dispatchShortcut: async () => true,
    onPrepareQuit: () => () => {},
    quitReady: async () => true,
    onAction: (listener) => actions.subscribe(listener),
    requestMicrophone: async () => true,
    appVersion: async () => '0.1.2',
    // The preview restarts by reloading its sample workspace.
    relaunchApp: async () => window.location.reload(),
    openPrivacyPane: async () => undefined,
    sharingHelp: async () => {
      throw new Error('In the app, this opens the sharing help page. This preview does not open external pages.')
    },
  }
  return api
}
