import type { SessionDetail } from '@/bridge/types/sessions'

export type SessionCopyKind = 'summary' | 'chat' | 'transcript'
export interface CopyLabels {
  untitled: string
  provider: string
  model: string
  started: string
  ended: string
  unknown: string
  inProgress: string
  you: string
  assistant: string
  others: string
}

export function sessionCopyText(
  session: SessionDetail,
  kind: SessionCopyKind,
  labels: CopyLabels,
  active: boolean,
  summary = session.summary,
  date = (value: string) => new Date(value).toLocaleString(),
) {
  if (kind === 'summary') return summary
  const header = `# ${session.title || labels.untitled}\n\n- ${labels.provider}: ${session.provider || labels.unknown}\n- ${labels.model}: ${session.model || labels.unknown}\n- ${labels.started}: ${session.started_at ? date(session.started_at) : labels.unknown}\n- ${labels.ended}: ${session.ended_at ? date(session.ended_at) : active ? labels.inProgress : labels.unknown}\n\n---\n\n`
  const rows = session.entries.filter((entry) =>
    kind === 'chat' ? entry.kind !== 'transcript' : entry.kind === 'transcript',
  )
  const body = rows
    .map((entry) => {
      const timestamp = entry.created_at ? ` · ${date(entry.created_at)}` : ''
      if (kind === 'transcript')
        return `- **${entry.speaker === 'ME' ? labels.you : labels.others}${timestamp}:** ${entry.content}`
      return `## ${entry.kind === 'user' ? labels.you : entry.kind === 'assistant' ? labels.assistant : entry.kind}${timestamp}\n\n${entry.content}`
    })
    .join(kind === 'chat' ? '\n\n---\n\n' : '\n')
  return (header + body).trim()
}

export async function writeSessionClipboard(
  value: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
  doc: Document | undefined = globalThis.document,
) {
  try {
    if (clipboard) {
      await clipboard.writeText(value)
      return true
    }
  } catch {
    /* Older Electron permissions can require the legacy copy path. */
  }
  if (!doc?.body) return false
  const previous = doc.activeElement as HTMLElement | null
  const area = doc.createElement('textarea')
  area.value = value
  area.readOnly = true
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  area.setAttribute('aria-hidden', 'true')
  try {
    doc.body.appendChild(area)
    area.focus()
    area.select()
    return Boolean(doc.execCommand('copy'))
  } catch {
    return false
  } finally {
    area.remove()
    previous?.focus?.({ preventScroll: true })
  }
}
