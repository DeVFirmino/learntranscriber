export interface SessionSelection {
  scope: string
  ids: Set<string>
}

export function selectionScope(page: number, query: string, includeTranscript: boolean): string {
  return JSON.stringify([page, query, includeTranscript])
}

export function toggleSessionSelection(current: SessionSelection, id: string): SessionSelection {
  const ids = new Set(current.ids)
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)
  return { scope: current.scope, ids }
}

export function visibleSessionSelection(current: SessionSelection, scope: string, rows: { id: string }[]): Set<string> {
  if (current.scope !== scope) return new Set()
  return new Set(rows.filter((session) => current.ids.has(session.id)).map((session) => session.id))
}
