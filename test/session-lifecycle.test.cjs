const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createSessionLifecycle } = require('../src/main/application/sessions/lifecycle.cjs');
const { sessionLifecycleRepository } = require('../src/main/infrastructure/sqlite/session-lifecycle.cjs');

function harness(t, overrides = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const calls = [],
    active = createActiveSession();
  const repository = sessionLifecycleRepository(repos);
  const sessions = {
    ...repository,
    end: (id, at) => {
      calls.push(`persist:${id}`);
      return repository.end(id, at);
    },
  };
  const lifecycle = createSessionLifecycle({
    sessions,
    active,
    defaults: () => ({ assistantId: 'general', metadata: {} }),
    requests: { cancelSession: (id) => calls.push(`cancel:${id}`) },
    systemAudio: {
      stop: async () => {
        calls.push('system-audio');
      },
    },
    appleSpeech: {
      stopSession: async (id) => {
        calls.push(`apple:${id}`);
      },
    },
    transcriptionJobs: {
      open: (id) => calls.push(`open:${id}`),
      close: async (id) => {
        calls.push(`drain:${id}`);
      },
    },
    now: () => new Date('2026-10-24T12:00:00.000Z'),
    changed: () => calls.push(`publish:${active.id()}`),
    ended: (id) => calls.push(`ended:${id}`),
    ...overrides,
  });
  return { repos, calls, active, lifecycle };
}

test('a second session cannot start while one is live', (t) => {
  const { lifecycle, active, calls } = harness(t);
  const first = lifecycle.create('First');
  assert.equal(active.id(), first.id);
  assert.throws(() => lifecycle.create('Second'), /End the active session before creating another/);
  assert.deepEqual(calls, [`publish:${first.id}`]);
});

test('resuming the live session is allowed; resuming another is refused', (t) => {
  const { lifecycle, repos, active, calls } = harness(t);
  const live = lifecycle.create('Live'),
    other = repos.sessions.create('Other', 'general');
  assert.equal(lifecycle.resume(live.id).id, live.id);
  assert.throws(() => lifecycle.resume(other.id), /End the active session first/);
  assert.equal(active.id(), live.id);
  assert.deepEqual(calls, [`publish:${live.id}`, `open:${live.id}`, `publish:${live.id}`]);
});

test('ending cancels, stops capture and drains before persisting, then clears, publishes and announces the end', async (t) => {
  const { lifecycle, repos, active, calls } = harness(t);
  const live = lifecycle.create('Live');
  calls.length = 0;
  const ended = await lifecycle.end(live.id);
  assert.equal(ended.ended_at, '2026-10-24T12:00:00.000Z');
  assert.equal(active.id(), null);
  assert.deepEqual(calls, [
    `cancel:${live.id}`,
    'system-audio',
    `apple:${live.id}`,
    `drain:${live.id}`,
    `persist:${live.id}`,
    'publish:null',
    `ended:${live.id}`,
  ]);
  assert.equal(repos.sessions.get(live.id).ended_at, '2026-10-24T12:00:00.000Z');
});

test('a failed capture stop leaves the session live and unpersisted', async (t) => {
  const { lifecycle, repos, active } = harness(t, {
    systemAudio: {
      stop: async () => {
        throw new Error('Audio helper stopped responding.');
      },
    },
  });
  const live = lifecycle.create('Live');
  await assert.rejects(lifecycle.end(live.id), /Audio helper stopped responding/);
  assert.equal(active.id(), live.id);
  assert.equal(repos.sessions.get(live.id).ended_at, null);
});

test('ending a past session keeps the live one', async (t) => {
  const { lifecycle, repos, active } = harness(t);
  const past = repos.sessions.create('Past', 'general'),
    live = lifecycle.create('Live');
  await lifecycle.end(past.id);
  assert.equal(active.id(), live.id);
});

test('the live session cannot be deleted; a past one is cancelled and removed', (t) => {
  const { lifecycle, repos, calls } = harness(t);
  const past = repos.sessions.create('Past', 'general'),
    live = lifecycle.create('Live');
  calls.length = 0;
  assert.throws(() => lifecycle.delete(live.id), /End the session before deleting it/);
  assert.deepEqual(calls, []);
  assert.equal(lifecycle.delete(past.id), true);
  assert.throws(() => repos.sessions.get(past.id), /Session not found/);
  assert.deepEqual(calls, [`cancel:${past.id}`, `publish:${live.id}`]);
});

test('a selection of past sessions is deleted together with one publication, and never the live one', (t) => {
  const { lifecycle, repos, calls } = harness(t);
  const first = repos.sessions.create('First', 'general'),
    second = repos.sessions.create('Second', 'general'),
    live = lifecycle.create('Live');
  calls.length = 0;
  assert.throws(() => lifecycle.deleteMany([first.id, live.id]), /End the session before deleting it/);
  assert.deepEqual(calls, []);
  assert.equal(repos.sessions.get(first.id).title, 'First');
  assert.equal(lifecycle.deleteMany([first.id, second.id]), 2);
  for (const id of [first.id, second.id]) assert.throws(() => repos.sessions.get(id), /Session not found/);
  assert.deepEqual(calls, [`cancel:${first.id}`, `cancel:${second.id}`, `publish:${live.id}`]);
});

test('starting or resuming announces the live session after it is published', (t) => {
  const started = [];
  const { lifecycle, calls } = harness(t, { started: (id) => started.push(`started:${id}:${calls.length}`) });
  const session = lifecycle.create('Live');
  lifecycle.resume(session.id);
  assert.deepEqual(started, [`started:${session.id}:1`, `started:${session.id}:3`]);
});

test('sessions an earlier run left open end at their last entry or their start, and the live one stays open', (t) => {
  const { repos, active, lifecycle } = harness(t);
  const [quiet, spoken, finished, live] = ['Quiet', 'Spoken', 'Finished', 'Live'].map((title) =>
    repos.sessions.create(title, 'general'),
  );
  repos.db.prepare('UPDATE sessions SET started_at=?').run('2026-10-24T09:00:00.000Z');
  const entry = repos.db.prepare('INSERT INTO entries(id,session_id,kind,content,created_at) VALUES (?,?,?,?,?)');
  entry.run('e1', spoken.id, 'transcript', 'Hello', '2026-10-24T09:20:00.000Z');
  entry.run('e2', spoken.id, 'assistant', 'Hi', '2026-10-24T09:05:00.000Z');
  entry.run('e3', live.id, 'transcript', 'Still talking', '2026-10-24T09:40:00.000Z');
  repos.sessions.update(finished.id, { ended_at: '2026-10-24T09:30:00.000Z' });
  active.set(live.id);
  assert.equal(lifecycle.closeLeftOpen(), 2);
  assert.equal(repos.sessions.get(quiet.id).ended_at, '2026-10-24T09:00:00.000Z');
  assert.equal(repos.sessions.get(spoken.id).ended_at, '2026-10-24T09:20:00.000Z');
  assert.equal(repos.sessions.get(finished.id).ended_at, '2026-10-24T09:30:00.000Z');
  assert.equal(repos.sessions.get(live.id).ended_at, null);
  assert.equal(lifecycle.closeLeftOpen(), 0);
});
