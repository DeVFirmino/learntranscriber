import type { SessionNotesApi } from '../types/session-notes'
import type { MockContext } from './state'
import { wait } from './simulated-delay'

const DEFAULT_FOLDER = '~/Documents/LearnTranscriber/Sessions'

// The browser preview pretends to write the note; nothing reaches the file system.
export function sessionNotesApi(ctx: MockContext): SessionNotesApi {
  const folder = () => ctx.settings.sessionNotesFolder || DEFAULT_FOLDER
  return {
    saveSessionNote: async (input) => {
      const session = ctx.requireSession(input.sessionId)
      await wait(600)
      return { path: `${folder()}/${session.title}.md` }
    },
    openSessionNote: async () => true,
    sessionNotesFolder: async () => folder(),
    chooseSessionNotesFolder: async () => {
      ctx.settings.sessionNotesFolder = '/Preview/Session notes'
      ctx.emit()
      return folder()
    },
  }
}
