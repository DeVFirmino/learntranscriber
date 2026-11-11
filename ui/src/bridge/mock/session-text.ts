import type { SessionDetail, SessionSummary } from '../types/sessions'

// Drops the entries and context a list view does not need, the same shape the native app publishes.
export function summaryOf(session: SessionDetail): SessionSummary {
  const { entries: _entries, context: _context, ...summary } = session
  return summary
}

// Renders a full session as the markdown file the export button downloads.
export function markdown(session: SessionDetail) {
  return `# ${session.title}\n\nStarted: ${session.started_at}\n\n${session.summary ? `## Summary\n\n${session.summary}\n\n` : ''}## Conversation\n\n${session.entries.map((entry) => `**${entry.speaker || entry.kind}** · ${entry.created_at}\n\n${entry.content}`).join('\n\n')}${session.context.length ? `\n\n## Attached context\n\n${session.context.map((item) => `### ${item.source}\n\n${item.content}`).join('\n\n')}` : ''}`
}
