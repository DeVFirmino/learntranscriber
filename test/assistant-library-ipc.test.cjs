const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { exportAssistant } = require('../src/main/domain/assistants/package.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerAssistantLibrary } = require('../src/main/interface/ipc/assistants.cjs');
const { createAssistantLibrary } = require('../src/main/application/assistants/manage.cjs');

function harness(t) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const handlers = new Map(),
    state = { changes: 0, copied: [], chosen: [] };
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerAssistantLibrary(
    handle,
    createAssistantLibrary({
      assistants: repos.assistants,
      clipboard: { writeText: (value) => state.copied.push(value) },
      changed: () => state.changes++,
    }),
    { choose: (ids) => state.chosen.push(ids) },
  );
  return { repos, state, call: (channel, ...args) => handlers.get(channel)({}, ...args) };
}

test('invalid saves and unknown deletes fail without publishing', async (t) => {
  const { repos, state, call } = harness(t);
  const before = repos.assistants.all().length;
  assert.equal((await call('assistants:save', { name: '' })).ok, false);
  assert.equal((await call('assistants:delete', 'missing')).ok, false);
  assert.equal(repos.assistants.all().length, before);
  assert.equal(state.changes, 0);
});

test('a saved assistant is returned, published once and deletable with one more publication', async (t) => {
  const { repos, state, call } = harness(t);
  const saved = await call('assistants:save', { name: 'Research', prompt: 'Ground answers.', category: 'Research' });
  assert.equal(saved.ok, true);
  assert.ok(repos.assistants.all().some((item) => item.id === saved.value));
  assert.equal(state.changes, 1);
  assert.equal((await call('assistants:delete', saved.value)).ok, true);
  assert.equal(state.changes, 2);
});

test('export copies the exact package once and import returns a draft without saving', async (t) => {
  const { repos, state, call } = harness(t);
  const id = repos.assistants.save({ name: 'Writer', prompt: 'Write clearly.', category: 'Writing' });
  assert.deepEqual(await call('assistants:export', id), { ok: true, value: true });
  assert.deepEqual(state.copied, [exportAssistant(repos.assistants.all().find((item) => item.id === id))]);
  const count = repos.assistants.all().length;
  const draft = await call('assistants:import', state.copied[0]);
  assert.equal(draft.value.name, 'Writer');
  assert.equal(repos.assistants.all().length, count);
  assert.equal(state.changes, 0);
});

test('assistant export does not report success when the asynchronous clipboard write fails', async (t) => {
  const { repos } = harness(t);
  const library = createAssistantLibrary({
    assistants: repos.assistants,
    clipboard: {
      writeText: async () => {
        throw new Error('Clipboard denied');
      },
    },
    changed: () => assert.fail('Export must not change the library'),
  });
  await assert.rejects(library.export('general'), /Clipboard denied/);
});

test('choosing built-ins accepts only a short list of ids', async (t) => {
  const { state, call } = harness(t);
  for (const ids of ['general', [1], Array.from({ length: 21 }, () => 'general'), ['x'.repeat(101)]])
    assert.equal((await call('assistants:choose-built-ins', ids)).ok, false);
  assert.equal((await call('assistants:choose-built-ins', ['general', 'math'])).ok, true);
  assert.deepEqual(state.chosen, [['general', 'math']]);
});
