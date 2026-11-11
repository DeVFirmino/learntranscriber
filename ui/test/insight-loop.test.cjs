const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { InsightLoop, liveTranscript } = loadTs('src/features/workspace/insight-loop.ts', { Error });

const plain = (value) => JSON.parse(JSON.stringify(value));
const line = (speaker, text, at) => ({ speaker, text, at });
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};

function harness() {
  const calls = [];
  const h = {
    calls,
    state: { activeSessionId: 's1', settings: { autoInsights: true, insightMode: 'proactive' } },
    recording: true,
    paused: false,
    listening: { sessionId: 's1', lines: [line('THEY', 'Hello.', 100), line('ME', 'Hi.', 200)] },
    captions: {},
    generating: false,
    clock: 5_000,
    trigger: null,
    question: '',
    hesitate: async () => false,
    answer: async () => 'An insight.',
    fire: null,
    names: () => calls.map((call) => call[0]),
    clear: () => calls.splice(0),
  };
  const scheduler = {
    question: '',
    reset: (lines, now) => calls.push(['reset', lines, now]),
    decide: (snapshot) => {
      calls.push(['decide', plain(snapshot)]);
      scheduler.question = h.question;
      return h.trigger;
    },
    requested: (lines, now) => calls.push(['requested', lines, now]),
    completed: (delivered) => calls.push(['completed', delivered]),
    failed: (now) => calls.push(['failed', now]),
  };
  h.loop = new InsightLoop({
    scheduler,
    hesitation: {
      update: (input) => {
        calls.push(['hesitation', plain(input)]);
        return h.hesitate(input);
      },
      reset: () => calls.push(['hesitation-reset']),
    },
    state: () => h.state,
    recording: () => h.recording,
    paused: () => h.paused,
    listening: () => h.listening,
    load: async (sessionId) => calls.push(['load', sessionId]),
    captions: () => h.captions,
    generating: () => h.generating,
    generate: (question, transcript, trigger) => {
      calls.push(['generate', question, transcript, trigger]);
      return h.answer();
    },
    failed: (error) => calls.push(['shown', error.message]),
    now: () => h.clock,
    every: (ms, run) => {
      calls.push(['every', ms]);
      h.fire = run;
      return () => calls.push(['stopped']);
    },
  });
  return h;
}

// The first tick of a listening run only marks where it starts.
async function started() {
  const h = harness();
  await h.loop.tick();
  h.clear();
  return h;
}

test('the live transcript keeps speakers with text, one per line, ending at the newest 20,000 characters', () => {
  assert.equal(liveTranscript({ ME: 'so I think', THEY: '  ', OTHER: 'right' }), 'ME: so I think\nOTHER: right');
  assert.equal(liveTranscript({}), '');
  const long = liveTranscript({ ME: 'x'.repeat(25_000) });
  assert.equal(long.length, 20_000);
  assert.equal(long.endsWith('x'), true);
});

test('the loop checks once a second, and stopping it clears the timer and any hesitation check', async () => {
  const h = harness();
  const stop = h.loop.start();
  assert.deepEqual(h.calls, [['every', 1_000]]);
  h.recording = false;
  h.fire();
  await flush();
  assert.deepEqual(h.names(), ['every', 'hesitation-reset']);
  stop();
  assert.deepEqual(h.names(), ['every', 'hesitation-reset', 'stopped', 'hesitation-reset']);
});

test('a run starts from the lines already saved, once the listening session is loaded', async () => {
  const h = harness();
  h.listening = null;
  await h.loop.tick();
  h.listening = { sessionId: 's0', lines: [] };
  await h.loop.tick();
  assert.deepEqual(h.calls, [
    ['load', 's1'],
    ['load', 's1'],
  ]);
  h.clear();
  h.listening = { sessionId: 's1', lines: [line('ME', 'One.', 1), line('ME', 'Two.', 2)] };
  await h.loop.tick();
  assert.deepEqual(h.calls, [['hesitation-reset'], ['reset', 2, 5_000]]);
});

test('nothing runs while not listening, paused, with auto insights off or without a session; the run then restarts', async () => {
  const blockers = [
    (h) => (h.recording = false),
    (h) => (h.paused = true),
    (h) => (h.state = { ...h.state, settings: { ...h.state.settings, autoInsights: false } }),
    (h) => (h.state = { ...h.state, activeSessionId: null }),
    (h) => (h.state = null),
  ];
  for (const block of blockers) {
    const h = await started();
    const saved = { ...h };
    block(h);
    await h.loop.tick();
    assert.deepEqual(h.calls, [['hesitation-reset']]);
    Object.assign(h, { recording: saved.recording, paused: saved.paused, state: saved.state });
    h.clear();
    await h.loop.tick();
    assert.deepEqual(h.names(), ['hesitation-reset', 'reset']);
  }
});

test('each tick reads the user speech for hesitation and gives the scheduler the full picture', async () => {
  const h = await started();
  h.captions = { ME: 'so what I mean', THEY: 'right' };
  h.hesitate = async () => true;
  h.clock = 9_000;
  await h.loop.tick();
  assert.deepEqual(h.calls, [
    ['hesitation', { sessionId: 's1', text: 'so what I mean', enabled: true, now: 9_000 }],
    [
      'decide',
      {
        now: 9_000,
        mode: 'proactive',
        lines: plain(h.listening.lines),
        live: { ME: 'so what I mean', THEY: 'right' },
        inFlight: false,
        isMeHesitating: true,
      },
    ],
  ]);
  const moderate = harness();
  moderate.state.settings.insightMode = 'moderate';
  await moderate.loop.tick();
  moderate.clear();
  await moderate.loop.tick();
  assert.deepEqual(moderate.calls[0], ['hesitation', { sessionId: 's1', text: '', enabled: false, now: 5_000 }]);
});

test('a trigger asks for an insight with its question, the live transcript and the trigger name, then reports what came back', async () => {
  const h = await started();
  h.trigger = 'question';
  h.question = 'What is the budget?';
  h.captions = { THEY: 'What is the budget?' };
  await h.loop.tick();
  assert.deepEqual(h.calls.slice(2), [
    ['requested', 2, 5_000],
    ['generate', 'What is the budget?', 'THEY: What is the budget?', 'question'],
    ['completed', true],
  ]);
  h.clear();
  h.trigger = 'periodic';
  h.question = '';
  h.captions = {};
  h.answer = async () => '   ';
  await h.loop.tick();
  assert.deepEqual(h.calls.slice(2), [
    ['requested', 2, 5_000],
    ['generate', undefined, '', 'invitation'],
    ['completed', false],
  ]);
});

test('while an insight or another answer is running, the scheduler is told it is in flight', async () => {
  const h = await started();
  const answer = deferred();
  h.trigger = 'periodic';
  h.answer = () => answer.promise;
  const first = h.loop.tick();
  await flush();
  h.trigger = null;
  h.clear();
  await h.loop.tick();
  assert.equal(h.calls[1][1].inFlight, true);
  answer.resolve('Done.');
  await first;
  h.clear();
  await h.loop.tick();
  assert.equal(h.calls[1][1].inFlight, false);
  h.generating = true;
  h.clear();
  await h.loop.tick();
  assert.equal(h.calls[1][1].inFlight, true);
});

test('a failed insight is recorded for retry and shown, and the next one can run', async () => {
  const h = await started();
  h.trigger = 'user-help';
  h.answer = async () => {
    throw new Error('Provider unavailable.');
  };
  await h.loop.tick();
  assert.deepEqual(h.calls.slice(2), [
    ['requested', 2, 5_000],
    ['generate', undefined, '', 'user-help'],
    ['failed', 5_000],
    ['shown', 'Provider unavailable.'],
  ]);
  h.trigger = null;
  h.clear();
  await h.loop.tick();
  assert.equal(h.calls[1][1].inFlight, false);
});

test('a slow hesitation check is dropped when listening stops or the session or its settings change meanwhile', async () => {
  const changes = [
    (h) => (h.recording = false),
    (h) => (h.state = { ...h.state, activeSessionId: 's2' }),
    (h) => (h.state = { ...h.state, settings: { ...h.state.settings, autoInsights: false } }),
    (h) => (h.state = { ...h.state, settings: { ...h.state.settings, insightMode: 'moderate' } }),
    (h) => (h.state = null),
  ];
  for (const change of changes) {
    const h = await started();
    const check = deferred();
    h.hesitate = () => check.promise;
    h.trigger = 'question';
    const tick = h.loop.tick();
    change(h);
    check.resolve(true);
    await tick;
    assert.deepEqual(h.names(), ['hesitation']);
  }
});
