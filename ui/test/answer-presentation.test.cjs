const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { answerPresentation } = loadTs('src/features/overlay/answer-presentation.ts');
const stream = {
  sessionId: 's',
  mode: 'chat',
  outcome: 'running',
  answer: 'Partial',
  streaming: true,
  responseId: 'r',
  startedAt: '',
};
const present = (extra = {}) =>
  answerPresentation({ entries: [], sessionId: 's', stream, requestId: null, pendingQuestion: '', ...extra });
const entry = (kind, content, request_id) => ({ id: kind, session_id: 's', kind, content, request_id });

test('foreign-session output and a previous failure cannot override the current pending question', () => {
  const other = present({ stream: { ...stream, sessionId: 'other' } });
  assert.equal(other.showStream, false);
  assert.equal(other.showEmpty, true);
  const pending = present({
    stream: { ...stream, outcome: 'error', streaming: false },
    requestId: 'new',
    pendingQuestion: 'Retry',
  });
  assert.equal(pending.completion, null);
  assert.equal(pending.showStream, false);
  assert.equal(pending.showProcessing, true);
  assert.equal(pending.showPendingQuestion, true);
});
test('request identity prevents duplicate pending questions and saved stream cards', () => {
  const savedQuestion = present({
    entries: [entry('user', 'Question', 'r')],
    requestId: 'r',
    pendingQuestion: 'Question',
  });
  assert.equal(savedQuestion.showPendingQuestion, false);
  const saved = present({ entries: [entry('assistant', 'Saved', 'r')] });
  assert.equal(saved.showStream, false);
  assert.equal(saved.showFollowUps, false);
  const finished = present({
    entries: [entry('assistant', 'Saved', 'r')],
    stream: { ...stream, streaming: false, outcome: 'saved' },
  });
  assert.equal(finished.showFollowUps, true);
});
test('terminal states preserve partial text, handle empty failure and keep insight labels', () => {
  for (const outcome of ['error', 'cancelled', 'interrupted']) {
    const state = present({ stream: { ...stream, outcome, streaming: false, mode: 'insight' } });
    assert.equal(state.showStream, true);
    assert.equal(state.streamRole, 'context');
    assert.equal(state.showProcessing, false);
    assert.equal(state.showFollowUps, false);
  }
  const empty = present({
    stream: { ...stream, outcome: 'error', streaming: false, answer: '', errorCode: 'timeout' },
  });
  assert.equal(empty.showStream, false);
  assert.equal(empty.showCompletionOnly, true);
  assert.equal(empty.completion.key, 'overlay.generationTimeout');
});
test('silent automatic output stays out of the conversation and an idle view can be empty', () => {
  assert.equal(present({ stream: { ...stream, answer: '...', outcome: 'saved', streaming: false } }).showEmpty, true);
});
