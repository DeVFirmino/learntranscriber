const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sessionMarkdown } = require('../src/main/domain/sessions/markdown-export.cjs');

const base = {
  title: 'Planning',
  started_at: '2026-10-31T10:00:00.000Z',
  summary: '',
  entries: [
    { kind: 'transcript', speaker: 'THEY', created_at: '2026-10-31T10:00:01.000Z', content: 'Ship on Friday.' },
    { kind: 'user', speaker: '', created_at: '2026-10-31T10:00:02.000Z', content: 'Who owns it?' },
  ],
  context: [],
};

test('a session exports as Markdown with speakers, or the entry kind when there is no speaker', () => {
  assert.equal(
    sessionMarkdown(base),
    '# Planning\n\nStarted: 2026-10-31T10:00:00.000Z\n\n## Conversation\n\n' +
      '**THEY** · 2026-10-31T10:00:01.000Z\n\nShip on Friday.\n\n**user** · 2026-10-31T10:00:02.000Z\n\nWho owns it?',
  );
});

test('the summary leads and attached context follows the conversation', () => {
  const markdown = sessionMarkdown({
    ...base,
    summary: 'Release Friday.',
    context: [{ source: 'selection', content: 'Release checklist' }],
  });
  assert.match(markdown, /^# Planning\n\nStarted: [^\n]+\n\n## Summary\n\nRelease Friday\.\n\n## Conversation\n\n/);
  assert.ok(markdown.endsWith('Who owns it?\n\n## Attached context\n\n### selection\n\nRelease checklist'));
});
