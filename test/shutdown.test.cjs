const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createShutdown } = require('../src/main/application/runtime/shutdown.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createLocalLiveTranscription } = require('../src/main/application/audio/local-live-transcription.cjs');

test('quit flushes recordings, drains transcription and settles requests before closing resources', async () => {
  const order = [];
  let pending = 1;
  const shutdown = createShutdown({
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    flushRecordings: async () => {
      order.push('flush');
    },
    drainTranscription: async () => {
      order.push('drain');
    },
    abortRequests: () => {
      order.push('abort');
      setTimeout(() => {
        pending = 0;
      }, 20);
    },
    pendingRequests: () => pending,
    closeResources: () => {
      order.push(pending ? 'close-early' : 'close');
      return [Promise.reject(new Error('one runtime failed')), Promise.resolve()];
    },
    log: () => {},
    poll: 5,
  });
  assert.equal(shutdown.accepts('ai:generate'), true);
  const run = shutdown.run();
  assert.equal(shutdown.run(), run, 'repeated quits share one sequence');
  assert.equal(shutdown.accepts('ai:generate'), false);
  assert.equal(shutdown.accepts('audio:transcribe'), true, 'draining still accepts recording flushes');
  await run;
  assert.deepEqual(order, ['flush', 'drain', 'abort', 'close']);
  assert.equal(shutdown.phase, 'closed');
});
test('a renderer that never confirms its flush cannot block quit', async () => {
  const closed = [];
  const shutdown = createShutdown({
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    flushRecordings: () => new Promise(() => {}),
    drainTranscription: async () => {},
    abortRequests: () => {},
    pendingRequests: () => 0,
    closeResources: () => {
      closed.push(true);
      return [];
    },
    flushTimeoutMs: 20,
    log: () => {},
  });
  await shutdown.run();
  assert.deepEqual(closed, [true]);
});
test('draining live transcription saves the buffered utterance that close would discard', async () => {
  for (const [method, saved] of [
    ['drain', 1],
    ['close', 0],
  ]) {
    const repos = createRepositories(openDatabase(':memory:')),
      id = repos.sessions.create('Quit', 'general').id;
    repos.settings.update({ transcriptionProvider: 'local', liveTranscription: true });
    const live = createLocalLiveTranscription({
      ...repos,
      models: { acquire: () => ({ release: () => {} }) },
      transcribe: async () => 'Last words before quit',
      onCaption: () => {},
    });
    try {
      live.start(1, id);
      for (let i = 0; i < 2; i++)
        live.push(1, { sessionId: id, speaker: 'ME', samples: new Int16Array(16000).fill(1000).buffer });
      await live[method]();
      assert.equal(
        repos.sessions.get(id).entries.filter((entry) => entry.content === 'Last words before quit').length,
        saved,
        method,
      );
    } finally {
      repos.db.close();
    }
  }
});
test('quit waits for accepted segment transcriptions and refuses new recorded audio after the flush', async () => {
  const { createTranscriptionJobs } = require('../src/main/application/audio/transcription-jobs.cjs');
  const jobs = createTranscriptionJobs(),
    order = [],
    logs = [];
  let finish;
  const accepted = jobs.run(
    's1',
    () =>
      new Promise((resolve) => {
        finish = () => {
          order.push('segment saved');
          resolve('text');
        };
      }),
  );
  const shutdown = createShutdown({
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    flushRecordings: () => new Promise(() => {}),
    flushTimeoutMs: 20,
    drainSegments: () => jobs.drainAll(),
    drainTranscription: async () => {},
    abortRequests: () => {},
    pendingRequests: () => 0,
    closeResources: () => {
      order.push('close');
      return [];
    },
    log: (message) => logs.push(message),
  });
  const run = shutdown.run();
  assert.equal(shutdown.accepts('audio:transcribe'), true, 'the final flush may still send segments');
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(shutdown.accepts('audio:transcribe'), false, 'no new recorded audio after the flush');
  await assert.rejects(
    jobs.run('s2', async () => 'late'),
    /closing/,
  );
  assert.deepEqual(order, [], 'nothing closes while a segment is still being transcribed');
  finish();
  await accepted;
  await run;
  assert.deepEqual(order, ['segment saved', 'close']);
  assert.ok(
    logs.some((message) => /did not finish flushing/.test(message)),
    'a flush timeout is reported, not treated as success',
  );
});

test('a drain or close that never settles cannot block quit, and the stuck step is logged', async () => {
  const logged = [];
  const shutdown = createShutdown({
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    flushRecordings: async () => {},
    drainSegments: () => new Promise(() => {}),
    drainTranscription: () => new Promise(() => {}),
    abortRequests: () => {},
    pendingRequests: () => 0,
    closeResources: () => [new Promise(() => {}), Promise.reject(new Error('helper gone'))],
    stepTimeoutMs: 20,
    log: (...args) => logged.push(args.join(' ')),
  });
  await shutdown.run();
  assert.equal(shutdown.phase, 'closed');
  for (const label of ['drain recorded segments', 'drain transcription', 'close resources'])
    assert.ok(
      logged.some((line) => line.includes(label)),
      label,
    );
});

test('a synchronous flush or drain failure does not skip later shutdown steps', async () => {
  const calls = [],
    logs = [];
  const fail = (name) => () => {
    calls.push(name);
    throw new Error(name + ' failed');
  };
  const shutdown = createShutdown({
    timers: { setTimeout, clearTimeout },
    now: Date.now,
    flushRecordings: fail('flush'),
    drainSegments: fail('segments'),
    drainTranscription: fail('transcription'),
    abortRequests: () => calls.push('abort'),
    pendingRequests: () => 0,
    closeResources: () => {
      calls.push('close');
      return [];
    },
    log: (...args) => logs.push(args.join(' ')),
  });
  await shutdown.run();
  assert.equal(shutdown.phase, 'closed');
  assert.deepEqual(calls, ['flush', 'segments', 'transcription', 'abort', 'close']);
  for (const message of ['flush failed', 'segments failed', 'transcription failed'])
    assert.ok(logs.some((line) => line.includes(message)));
});

test('requests that never settle are waited for until the deadline on the injected clock, then resources close', async () => {
  let clock = 0;
  const polls = [],
    calls = [];
  // Each poll advances the fake clock instead of waiting; the bounded steps finish before their timers fire.
  const timers = {
    setTimeout: (run, ms) => {
      if (ms === 25) {
        clock += ms;
        polls.push(clock);
      }
      setImmediate(run);
      return {};
    },
    clearTimeout: () => {},
  };
  const shutdown = createShutdown({
    timers,
    now: () => clock,
    flushRecordings: async () => {},
    drainTranscription: async () => {},
    abortRequests: () => calls.push('abort'),
    pendingRequests: () => 1,
    closeResources: () => {
      calls.push(`close at ${clock}`);
      return [];
    },
    log: () => {},
    requestTimeoutMs: 100,
    poll: 25,
  });
  await shutdown.run();
  assert.deepEqual(polls, [25, 50, 75, 100]);
  assert.deepEqual(calls, ['abort', 'close at 100']);
});
