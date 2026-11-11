const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateGenerationRequest } = require('../src/main/domain/sessions/generation-admission.cjs');
const { checkHesitation } = require('../src/main/application/sessions/hesitation-check.cjs');

const heard = { id: 's1', entries: [{ kind: 'transcript', content: 'Hello.' }] };
const silent = { id: 's1', entries: [] };
const admit = (input, mode, session = heard, active = 's1') =>
  validateGenerationRequest({ requestId: 'r1', sessionId: 's1', ...input }, mode, session, active);

test('a plain chat request and a live insight with speech are admitted', () => {
  assert.doesNotThrow(() => admit({ question: 'What next?' }, 'chat', silent));
  assert.doesNotThrow(() => admit({ liveTranscript: 'ME: so we' }, 'insight', silent));
  assert.doesNotThrow(() => admit({ liveTranscript: 'ME: so we' }, 'insightHesitation', silent));
});

test('live speech is refused outside the modes that use it', () => {
  assert.throws(() => admit({ liveTranscript: 'ME: hi' }, 'chat'), /only used for live insights/);
});

test('a hesitation check needs the listening session and live speech; insights need a transcript', () => {
  assert.throws(
    () => admit({ liveTranscript: 'ME: so' }, 'insightHesitation', heard, 's2'),
    /active listening session/,
  );
  assert.throws(() => admit({ liveTranscript: '  ' }, 'insightHesitation'), /active listening session/);
  assert.throws(() => admit({}, 'insight', silent), /Add or record a transcript/);
  assert.doesNotThrow(() => admit({}, 'insight'));
});

function providers(answer, onStream = () => {}) {
  const calls = [];
  return {
    calls,
    ready: async (route) => calls.push(['ready', route.model]),
    checkContext: async (_route, messages) => calls.push(['check', messages.length]),
    stream: async (_route, messages) => {
      calls.push(['stream', messages[1].content]);
      onStream();
      return answer;
    },
  };
}

test('the hesitation check answers HESITATING or FLUENT for the speech it was given', async () => {
  const route = { model: 'fast' };
  const active = { id: () => 's1' };
  const signal = new AbortController().signal;
  const hesitating = providers('hesitating, the user trailed off');
  assert.equal(
    await checkHesitation({
      providers: hesitating,
      active,
      sessionId: 's1',
      route,
      liveTranscript: 'ME: so I',
      signal,
    }),
    'HESITATING',
  );
  assert.deepEqual(hesitating.calls, [
    ['ready', 'fast'],
    ['check', 2],
    ['stream', 'ME: so I'],
  ]);
  assert.equal(
    await checkHesitation({
      providers: providers('FLUENT'),
      active,
      sessionId: 's1',
      route,
      liveTranscript: 'x',
      signal,
    }),
    'FLUENT',
  );
});

test('a hesitation answer is dropped when the listening session changed meanwhile', async () => {
  let current = 's1';
  const changing = providers('HESITATING', () => (current = 's2'));
  await assert.rejects(
    checkHesitation({
      providers: changing,
      active: { id: () => current },
      sessionId: 's1',
      route: { model: 'fast' },
      liveTranscript: 'ME: so',
      signal: new AbortController().signal,
    }),
    /listening session changed/,
  );
});

test('summaries accept saved conversation in an ended session without a live transcript', () => {
  const session = {
    id: 'ended',
    ended_at: '2026-11-05',
    entries: [
      { kind: 'user', content: 'What did we agree?' },
      { kind: 'assistant', content: 'Test the empty list.' },
    ],
  };
  assert.doesNotThrow(() => admit({}, 'summary', session, null));
  assert.throws(() => admit({}, 'summary', { id: 'empty', entries: [] }, null), /Add or record/);
  assert.throws(() => admit({}, 'translation', session, null), /Add or record/);
});
