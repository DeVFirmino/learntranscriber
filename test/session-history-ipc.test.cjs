const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerSessionHistory } = require('../src/main/interface/ipc/session-history.cjs');
const { createSessionHistory } = require('../src/main/application/sessions/history.cjs');
const { sessionHistoryRepository } = require('../src/main/infrastructure/sqlite/session-history.cjs');

const app = { frame: 'app' },
  foreign = { frame: 'foreign' };
function harness(t) {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-history-'));
  const repos = createRepositories(openDatabase(join(directory, 'data.sqlite')));
  t.after(() => {
    repos.db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const handlers = new Map(),
    state = { active: '', changes: 0, closing: false };
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: (event) => {
      if (event !== app) throw new Error('This request did not originate from an application window.');
    },
    accepts: () => !state.closing,
  });
  registerSessionHistory(
    handle,
    createSessionHistory({
      sessions: sessionHistoryRepository(repos),
      activeSessionId: () => state.active,
      changed: () => state.changes++,
    }),
  );
  return { repos, state, call: (channel, event, ...args) => handlers.get(channel)(event, ...args) };
}

test('history channels refuse foreign frames and a closing app without touching data', async (t) => {
  const { repos, state, call } = harness(t);
  const session = repos.sessions.create('Original', 'general');
  assert.deepEqual(await call('sessions:rename', foreign, { id: session.id, title: 'Hijacked' }), {
    ok: false,
    error: 'This request did not originate from an application window.',
  });
  state.closing = true;
  assert.deepEqual(await call('sessions:get', app, session.id), { ok: false, error: 'LearnTranscriber is closing.' });
  assert.equal(repos.sessions.get(session.id).title, 'Original');
  assert.equal(state.changes, 0);
});

test('queries return store DTOs without publishing; each edit publishes exactly once', async (t) => {
  const { repos, state, call } = harness(t);
  const session = repos.sessions.create('Design review', 'general');
  assert.deepEqual(await call('sessions:get', app, ` ${session.id} `), {
    ok: true,
    value: repos.sessions.get(session.id),
  });
  assert.deepEqual(await call('sessions:list', app, 'Design'), { ok: true, value: repos.sessionSearch.list('Design') });
  assert.equal(state.changes, 0);
  const renamed = await call('sessions:rename', app, { id: session.id, title: 'Architecture review' });
  assert.equal(renamed.value.title, 'Architecture review');
  const summarized = await call('sessions:update-summary', app, {
    id: session.id,
    summary: 'Ship it.',
    expectedSummary: '',
  });
  assert.equal(summarized.value.summary, 'Ship it.');
  assert.equal(state.changes, 2);
});

test('a stale summary and an invalid id fail with the current messages and no publication', async (t) => {
  const { repos, state, call } = harness(t);
  const session = repos.sessions.create('Planning', 'general');
  repos.sessions.updateSummary(session.id, 'Newer manual overview', '');
  const stale = await call('sessions:update-summary', app, {
    id: session.id,
    summary: 'Late draft',
    expectedSummary: '',
  });
  assert.equal(stale.ok, false);
  assert.equal(repos.sessions.get(session.id).summary, 'Newer manual overview');
  assert.deepEqual(await call('sessions:get', app, ''), {
    ok: false,
    error: 'Enter valid text within the length limit.',
  });
  assert.equal(state.changes, 0);
});

test('paging hides the active session unless the caller includes it', async (t) => {
  const { repos, state, call } = harness(t);
  const active = repos.sessions.create('Live', 'general'),
    past = repos.sessions.create('Past', 'general');
  state.active = active.id;
  const ids = (result) => result.value.sessions.map((item) => item.id);
  assert.deepEqual(ids(await call('sessions:page', app, {})), [past.id]);
  assert.deepEqual(
    new Set(ids(await call('sessions:page', app, { excludeActive: false }))),
    new Set([active.id, past.id]),
  );
});
