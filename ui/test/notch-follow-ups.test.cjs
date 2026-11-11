const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const plain = (value) => JSON.parse(JSON.stringify(value));
const { NotchFollowUps, offersFollowUps } = loadTs('src/features/notch-follow-ups.ts', { Error });

const longText = 'An answer long enough to suggest follow-up questions about it.';
const insight = (id, text = longText) => ({ id, entryId: `e-${id}`, text });

function harness() {
  let state = {},
    session = 's1',
    id = 0;
  const sent = [],
    pending = [],
    cancelled = [];
  const followUps = new NotchFollowUps({
    followUps: (input) =>
      new Promise((resolve, reject) => {
        sent.push(input);
        pending.push({ resolve, reject });
      }),
    cancel: async (requestId) => {
      cancelled.push(requestId);
      return true;
    },
    update: (change) => {
      state = change(state);
    },
    newId: () => `r${++id}`,
  });
  followUps.setSession(session);
  const request = (item, overrides = {}) => ({
    sessionId: 's1',
    insight: item,
    enabled: true,
    busy: false,
    failure: 'Suggestions failed.',
    ...overrides,
  });
  return {
    followUps,
    request,
    sent,
    pending,
    cancelled,
    state: () => state,
    changeSession: (value) => {
      session = value;
      followUps.setSession(value);
    },
  };
}

test('only a saved answer of at least 50 characters offers follow-ups', () => {
  assert.equal(offersFollowUps(undefined), false);
  assert.equal(offersFollowUps({ id: 'a', text: longText }), false);
  assert.equal(offersFollowUps(insight('a', `   ${'x'.repeat(49)}   `)), false);
  assert.equal(offersFollowUps(insight('a', 'x'.repeat(50))), true);
});

test('suggestions show as busy while requested and load for the saved entry', async () => {
  const h = harness();
  const done = h.followUps.generate(h.request(insight('i1')));
  assert.deepEqual(plain(h.state().i1), { suggestions: [], busy: true, loaded: false, error: '' });
  assert.deepEqual(plain(h.sent), [{ requestId: 'r1', sessionId: 's1', entryId: 'e-i1', historical: true }]);
  h.pending[0].resolve({ entryId: 'e-i1', suggestions: [{ text: 'Why?', prompt: 'Explain why.' }] });
  await done;
  assert.deepEqual(plain(h.state().i1), {
    suggestions: [{ text: 'Why?', prompt: 'Explain why.' }],
    busy: false,
    loaded: true,
    error: '',
  });
});

test('nothing is requested when off, busy, without a session, for an unsaved or short answer, or twice', async () => {
  const h = harness();
  await h.followUps.generate(h.request(insight('i1'), { enabled: false }));
  await h.followUps.generate(h.request(insight('i1'), { busy: true }));
  await h.followUps.generate(h.request(insight('i1'), { sessionId: undefined }));
  await h.followUps.generate(h.request(undefined));
  await h.followUps.generate(h.request({ id: 'i1', text: longText }));
  await h.followUps.generate(h.request(insight('i1', 'Too short.')));
  assert.equal(h.sent.length, 0);
  assert.deepEqual(plain(h.state()), {});
  void h.followUps.generate(h.request(insight('i1')));
  await h.followUps.generate(h.request(insight('i1')));
  assert.equal(h.sent.length, 1);
});

test('cancelling stops the request, resets the insight and ignores its late answer', async () => {
  const h = harness();
  const done = h.followUps.generate(h.request(insight('i1')));
  h.followUps.cancel('i1');
  assert.deepEqual(h.cancelled, ['r1']);
  assert.deepEqual(plain(h.state().i1), { suggestions: [], busy: false, loaded: false, error: '' });
  h.pending[0].resolve({ entryId: 'e-i1', suggestions: [{ text: 'Late', prompt: 'Late' }] });
  await done;
  assert.deepEqual(plain(h.state().i1), { suggestions: [], busy: false, loaded: false, error: '' });
  h.followUps.cancel('i2');
  assert.deepEqual(h.cancelled, ['r1']);
  assert.deepEqual(plain(h.state().i2), { suggestions: [], busy: false, loaded: false, error: '' });
});

test('an answer for another entry or after the session changed is not shown', async () => {
  const h = harness();
  const other = h.followUps.generate(h.request(insight('i1')));
  h.pending[0].resolve({ entryId: 'e-other', suggestions: [{ text: 'Wrong', prompt: 'Wrong' }] });
  await other;
  // Like the session panel's suggestions, the insight goes back to idle so it can be asked again.
  assert.deepEqual(plain(h.state().i1), { suggestions: [], busy: false, loaded: false, error: '' });
  const moved = h.followUps.generate(h.request(insight('i2')));
  h.changeSession('s2');
  h.pending[1].resolve({ entryId: 'e-i2', suggestions: [{ text: 'Old', prompt: 'Old' }] });
  await moved;
  assert.equal(h.state().i2.loaded, false);
  h.changeSession('s1');
  void h.followUps.generate(h.request(insight('i2')));
  assert.equal(h.sent.length, 3);
});

test('a failure shows its own message or the fallback, and the insight can be asked again', async () => {
  const h = harness();
  const first = h.followUps.generate(h.request(insight('i1')));
  h.pending[0].reject(new Error('Provider unavailable.'));
  await first;
  assert.deepEqual(plain(h.state().i1), {
    suggestions: [],
    busy: false,
    loaded: false,
    error: 'Provider unavailable.',
  });
  const second = h.followUps.generate(h.request(insight('i1')));
  h.pending[1].reject('no reason');
  await second;
  assert.equal(h.state().i1.error, 'Suggestions failed.');
  const late = h.followUps.generate(h.request(insight('i2')));
  h.changeSession('s2');
  h.pending[2].reject(new Error('Too late.'));
  await late;
  assert.equal(h.state().i2.error, '');
});

test('retaining the history forgets dropped insights and cancels only their requests', async () => {
  const h = harness();
  const dropped = h.followUps.generate(h.request(insight('i1')));
  void h.followUps.generate(h.request(insight('i2')));
  h.followUps.retain(new Set(['i2']));
  assert.deepEqual(h.cancelled, ['r1']);
  assert.deepEqual(Object.keys(h.state()), ['i2']);
  const kept = h.state();
  h.followUps.retain(new Set(['i2']));
  assert.equal(h.state(), kept);
  assert.deepEqual(h.cancelled, ['r1']);
  h.pending[0].resolve({ entryId: 'e-i1', suggestions: [] });
  await dropped;
  assert.equal(h.state().i1, undefined);
});

test('cancelling everything stops every pending request and ignores their answers', async () => {
  const h = harness();
  const first = h.followUps.generate(h.request(insight('i1')));
  const second = h.followUps.generate(h.request(insight('i2')));
  h.followUps.cancelAll();
  assert.deepEqual(h.cancelled, ['r1', 'r2']);
  h.pending[0].resolve({ entryId: 'e-i1', suggestions: [] });
  h.pending[1].reject(new Error('Cancelled.'));
  await Promise.all([first, second]);
  assert.equal(h.state().i1.loaded, false);
  assert.equal(h.state().i2.error, '');
  h.followUps.cancelAll();
  assert.deepEqual(h.cancelled, ['r1', 'r2']);
});
