// A live insight that comes back as the idle "..." is neither saved nor shown, keeping the last
// visible insight on screen; any other answer is saved and published.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnswerPublisher } = require('../src/main/application/sessions/generation-answer.cjs');

function publisher() {
  const saved = [],
    published = [];
  const publish = createAnswerPublisher({
    sessions: { persistOutput: (_session, _mode, answer) => (saved.push(answer), { id: `e${saved.length}` }) },
    notch: { presentAnswer: () => null },
    summaryRewrite: { clean: (text) => text },
    events: { answer: (payload) => published.push(payload) },
    changed: () => {},
  });
  return { publish, saved, published };
}

test('an idle insight answer is dropped and clears the arriving answer', () => {
  const { publish, saved, published } = publisher();
  assert.equal(publish({ id: 'r1', mode: 'insight', session: { id: 's1' }, answer: '...', sequence: 1 }), '');
  assert.deepEqual(saved, []);
  assert.equal(published[0].text, '');
  assert.equal(published[0].silent, true);
});

test('a real insight answer and a chat answer of dots are saved', () => {
  const { publish, saved } = publisher();
  publish({ id: 'r1', mode: 'insight', session: { id: 's1' }, answer: 'Lima.', sequence: 1 });
  publish({ id: 'r2', mode: 'chat', session: { id: 's1' }, answer: '...', sequence: 2 });
  assert.deepEqual(saved, ['Lima.', '...']);
});
