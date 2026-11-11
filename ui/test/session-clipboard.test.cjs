const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { sessionCopyText, writeSessionClipboard } = loadTs('src/features/session-clipboard.ts');
const labels = {
  untitled: 'Untitled session',
  provider: 'Provider',
  model: 'Model',
  started: 'Started',
  ended: 'Ended',
  unknown: 'Unknown',
  inProgress: 'In progress',
  you: 'You',
  assistant: 'Assistant',
  others: 'Others',
};
const session = {
  title: 'Planning',
  provider: 'openai',
  model: 'fixture-model',
  started_at: 'start',
  ended_at: 'end',
  summary: 'Saved overview',
  entries: [
    { kind: 'transcript', speaker: 'ME', content: 'My words', created_at: 't1' },
    { kind: 'transcript', speaker: 'THEY', content: 'Their words', created_at: 't2' },
    { kind: 'user', content: 'Question?', created_at: 't3' },
    { kind: 'assistant', content: 'Answer.', created_at: 't4' },
  ],
};
const date = (value) => `date(${value})`;
const header =
  '# Planning\n\n- Provider: openai\n- Model: fixture-model\n- Started: date(start)\n- Ended: date(end)\n\n---\n\n';

test('separate chat/transcript documents preserve metadata, speaker labels and their own entry content', () => {
  assert.equal(
    sessionCopyText(session, 'chat', labels, false, undefined, date),
    header + '## You · date(t3)\n\nQuestion?\n\n---\n\n## Assistant · date(t4)\n\nAnswer.',
  );
  assert.equal(
    sessionCopyText(session, 'transcript', labels, false, undefined, date),
    header + '- **You · date(t1):** My words\n- **Others · date(t2):** Their words',
  );
  assert.equal(sessionCopyText(session, 'summary', labels, false, 'Unsaved current draft'), 'Unsaved current draft');
  assert.equal(
    sessionCopyText(session, 'summary', labels, false, ''),
    '',
    'an empty current draft does not copy an old summary',
  );
  assert.match(
    sessionCopyText({ ...session, provider: null, model: null, ended_at: null }, 'chat', labels, true, undefined, date),
    /Provider: Unknown\n- Model: Unknown[\s\S]*Ended: In progress/,
  );
});

test('clipboard permission failure falls back to a hidden selectable textarea and restores focus', async () => {
  const calls = [];
  const area = {
    style: {},
    setAttribute: () => {},
    focus: () => calls.push('focus-copy'),
    select: () => calls.push('select'),
    remove: () => calls.push('remove'),
  };
  const doc = {
    body: { appendChild: () => calls.push('append') },
    activeElement: { focus: () => calls.push('restore-focus') },
    createElement: () => area,
    execCommand: (command) => {
      calls.push(command);
      return true;
    },
  };
  assert.equal(
    await writeSessionClipboard(
      'Clipboard body',
      {
        writeText: async () => {
          throw new Error('permission denied');
        },
      },
      doc,
    ),
    true,
  );
  assert.equal(area.value, 'Clipboard body');
  assert.equal(area.readOnly, true);
  assert.deepEqual(calls, ['append', 'focus-copy', 'select', 'copy', 'remove', 'restore-focus']);
});

test('modern clipboard success skips fallback and a failed legacy copy reports failure after cleanup', async () => {
  let copied;
  assert.equal(
    await writeSessionClipboard(
      'Summary',
      {
        writeText: async (value) => {
          copied = value;
        },
      },
      undefined,
    ),
    true,
  );
  assert.equal(copied, 'Summary');
  let removed = false;
  const doc = {
    body: { appendChild: () => {} },
    activeElement: null,
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      focus: () => {},
      select: () => {},
      remove: () => {
        removed = true;
      },
    }),
    execCommand: () => false,
  };
  assert.equal(await writeSessionClipboard('Summary', undefined, doc), false);
  assert.equal(removed, true);
});
