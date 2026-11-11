// A stopped session's summary and handoff, saved as a Markdown file in the notes folder.
export interface SessionNotesApi {
  saveSessionNote: (input: { requestId: string; sessionId: string }) => Promise<{ path: string }>
  openSessionNote: (path: string) => Promise<boolean>
  sessionNotesFolder: () => Promise<string>
  chooseSessionNotesFolder: () => Promise<string>
}
