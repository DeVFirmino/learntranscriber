const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { conversationEntries, generatedRole } = loadTs('src/features/overlay/conversation-entries.ts');
const entry = (id, kind, content, extra = {}) => ({ id, session_id: 'session', kind, content, ...extra });
test('typed questions are right-side turns; meeting speech never becomes a typed user message', () => {
  const shown = conversationEntries(
    [
      entry('speech', 'transcript', 'Meeting participant', { speaker: 'ME' }),
      entry('insight', 'assistant', 'Context from the meeting'),
      entry('question', 'user', 'What next?'),
      entry('speech-2', 'transcript', 'Another participant'),
      entry('answer', 'assistant', 'Confirm the deadline'),
    ],
    'session',
  );
  assert.deepEqual(
    Array.from(shown, ({ role }) => role),
    ['context', 'user', 'assistant'],
  );
});
test('all complete turns survive; duplicate entries, placeholders and foreign sessions are excluded', () => {
  const entries = Array.from({ length: 30 }, (_, n) => entry(String(n), n % 2 ? 'assistant' : 'user', 'Text'));
  entries.push(entries[0], entry('silent', 'assistant', '…'), entry('other', 'user', 'Other', { session_id: 'other' }));
  const shown = conversationEntries(entries, 'session');
  assert.equal(shown.length, 30);
  assert.equal(shown.at(-1).entry.id, '29');
});

test('an insight after a failed or cancelled question is contextual, not that question’s reply', () => {
  for (const generation_mode of ['insight', 'screenInsight']) {
    const shown = conversationEntries(
      [
        entry('failed', 'user', 'Question without a reply', { generation_mode: 'chat', request_id: 'failed-request' }),
        entry('insight', 'assistant', 'Automatic context', { generation_mode, request_id: 'insight-request' }),
        entry('reply', 'assistant', 'Actual reply', { generation_mode: 'chat', request_id: 'chat-request' }),
      ],
      'session',
    );
    assert.deepEqual(
      Array.from(shown, ({ role }) => role),
      ['user', 'context', 'assistant'],
    );
  }
});

test('explicit new insight metadata also overrides an unanswered legacy question', () => {
  const shown = conversationEntries(
    [
      entry('old', 'user', 'Old question'),
      entry('new', 'assistant', 'Insight', { generation_mode: 'insight', request_id: 'new-request' }),
    ],
    'session',
  );
  assert.equal(shown[1].role, 'context');
});

test('live generation roles distinguish both insight modes from direct chat', () => {
  assert.equal(generatedRole('insight'), 'context');
  assert.equal(generatedRole('screenInsight'), 'context');
  assert.equal(generatedRole('chat'), 'assistant');
  assert.equal(generatedRole(undefined), 'assistant');
});
