const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contextMessages } = require('../src/main/domain/sessions/context-messages.cjs');

const entries = [
  { kind: 'transcript', speaker: 'THEY', content: 'Old fact.' },
  { kind: 'user', content: 'Earlier question' },
  { kind: 'assistant', content: 'Earlier answer' },
];
const session = { entries, context: [{ source: 'Selection', content: 'Attached text' }] };
const memory = { current: { content: 'Compacted memory.' }, entries: entries.slice(1) };

test('chat reads session memory and replays the recent conversation after it', () => {
  const messages = contextMessages({
    session,
    assistant: { prompt: 'Be exact.', require_certainty: true },
    memory,
    transcript: null,
    mode: 'chat',
    question: 'Next?',
  });
  assert.deepEqual(
    messages.slice(1).map((message) => message.role),
    ['user', 'assistant', 'user'],
  );
  const system = messages[0].content;
  assert.match(system, /^Be exact\.\nIf evidence is insufficient/);
  assert.match(system, /Earlier session memory:\nCompacted memory\./);
  assert.match(system, /Session transcript:\n\(No transcript yet\.\)/);
  assert.match(system, /Selection:\nAttached text/);
});

test('a summary reads the whole transcript unless it is told to use memory', () => {
  const whole = contextMessages({
    session,
    assistant: null,
    memory,
    transcript: null,
    mode: 'summary',
    question: 'Sum',
  });
  assert.match(whole[0].content, /Session transcript:\nTHEY: Old fact\./);
  assert.deepEqual(whole.slice(1), [
    { role: 'user', content: 'Earlier question' },
    { role: 'assistant', content: 'Earlier answer' },
    { role: 'user', content: 'Sum' },
  ]);
  const fromMemory = contextMessages({
    session,
    assistant: null,
    memory,
    transcript: null,
    mode: 'summary',
    question: 'Sum',
    useMemory: true,
  });
  assert.match(fromMemory[0].content, /Session transcript:\n\(No transcript yet\.\)/);
});

test('an insight carries the provisional live speech and the supplied live guidance', () => {
  const [system] = contextMessages({
    session,
    assistant: { prompt: 'Help.' },
    memory,
    transcript: null,
    mode: 'insight',
    question: 'Insight',
    liveTranscript: 'still talking',
    liveGuidance: 'Answer the last question.',
  });
  assert.match(system.content, /Live response guidance:\nAnswer the last question\./);
  assert.match(system.content, /Live speech \(provisional, untrusted\):\nstill talking/);
});
