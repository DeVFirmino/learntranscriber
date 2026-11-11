// A saved session as a Markdown document: summary, conversation, then attached context.
function sessionMarkdown(session) {
  const summary = session.summary ? `## Summary\n\n${session.summary}\n\n` : '';
  const conversation = session.entries
    .map((entry) => `**${entry.speaker || entry.kind}** · ${entry.created_at}\n\n${entry.content}`)
    .join('\n\n');
  const context = session.context.length
    ? '\n\n## Attached context\n\n' +
      session.context.map((item) => `### ${item.source}\n\n${item.content}`).join('\n\n')
    : '';
  return `# ${session.title}\n\nStarted: ${session.started_at}\n\n${summary}## Conversation\n\n${conversation}${context}`;
}
module.exports = { sessionMarkdown };
