const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createTranscriptCompactor, eligible } = require('../src/main/application/compaction/transcript.cjs');
const { messagesFor } = require('../src/main/application/sessions/context-preparation.cjs');
function fixture(t, count = 100, stream) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  let id = repos.sessions.create('Transcript fixture', 'general').id;
  for (let i = 0; i < count; i++)
    repos.entries.add(id, 'transcript', `Unique line_${i}. Decision number ${i}.`, i % 2 ? 'THEY' : 'ME');
  const repo = repos.transcriptMemory;
  const calls = [],
    errors = [];
  let memories = 0;
  const service = createTranscriptCompactor({
    repository: repo,
    active: { id: () => id },
    listening: () => ({ active: true }),
    settings: () => ({ autoCompact: true, uiLanguage: 'pt-BR' }),
    route: { run: async (s, work) => work(s) },
    providers: {
      checkContext: async () => {},
      stream: async (s, m) => {
        calls.push(m);
        return stream ? stream(s, m) : `Memory_${calls.length}`;
      },
    },
    changed: () => {},
    report: (e) => errors.push(e),
    // Built after any timer mock a test enables, so the mock reaches the compactor.
    timers: { setTimeout, clearTimeout },
    now: () => new Date(),
    newId: () => `memory-${++memories}`,
  });
  t.after(() => service.close());
  return { repos, id, repo, service, calls, errors, switchSession: () => (id = 'other') };
}
test('transcript policy starts at 100 lines keeps 30 and waits for 20 new lines independently of chat memory', async (t) => {
  const f = fixture(t);
  assert.equal(eligible({ ...f.repo.snapshot(f.id), total: 99 }), false);
  await f.service.compact(f.id);
  assert.equal(f.repo.snapshot(f.id).entries.length, 30);
  assert.equal(f.repos.sessions.get(f.id).entries.length, 100);
  assert.equal(f.repos.sessions.get(f.id).compaction.count, 0);
  assert.match(f.calls[0][0].content, /\[ME\]: Unique line_0/);
  assert.match(f.calls[0][0].content, /Portuguese/);
  for (let i = 0; i < 19; i++) f.repos.entries.add(f.id, 'transcript', 'New fact ' + i, 'THEY');
  await f.service.compact(f.id);
  assert.equal(f.calls.length, 1);
  f.repos.entries.add(f.id, 'transcript', 'Twentieth fact', 'ME');
  await f.service.compact(f.id);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[1][0].content, /CURRENT COMPACTED SUMMARY:\nMemory_1/);
  assert.equal(f.repo.snapshot(f.id).entries.length, 30);
  const chat = messagesFor(f.repos, f.id, 'chat', 'Next?');
  assert.match(chat[0].content, /Memory_2/);
  assert.doesNotMatch(chat[0].content, /Unique line_0\./);
  const summary = messagesFor(f.repos, f.id, 'summary', 'Summary');
  assert.match(summary[0].content, /Unique line_0\./);
  assert.equal(f.repos.sessionSearch.list('Unique line_0').length, 1);
});
test('transcript compaction schedules after 3000ms and closes without leaving a pending request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.service.update();
  t.mock.timers.tick(2999);
  assert.equal(f.calls.length, 0);
  t.mock.timers.tick(1);
  await new Promise(setImmediate);
  assert.equal(f.calls.length, 1);
  await f.service.close();
  t.mock.timers.tick(10000);
  assert.equal(f.calls.length, 1);
});
test('a late transcript summary from a previous session cannot replace its memory', async (t) => {
  let release;
  const f = fixture(t, 100, () => new Promise((r) => (release = r)));
  const pending = f.service.compact(f.id);
  await new Promise(setImmediate);
  f.switchSession();
  f.service.update();
  release('Late summary');
  await pending;
  assert.equal(f.repo.snapshot(f.id).current, null);
  assert.equal(f.repos.sessions.get(f.id).entries.length, 100);
});
test('failed or empty transcript summaries leave the full source and checkpoint untouched', async (t) => {
  const f = fixture(t, 100, async () => {
    throw new Error('Fixture model failure');
  });
  await f.service.compact(f.id);
  assert.equal(f.repo.snapshot(f.id).current, null);
  assert.equal(f.repos.sessions.get(f.id).entries.length, 100);
  assert.deepEqual(f.errors, ['Fixture model failure']);
  const empty = fixture(t, 100, async () => '');
  await empty.service.compact(empty.id);
  assert.equal(empty.repo.snapshot(empty.id).current, null);
  assert.match(empty.errors[0], /invalid summary/);
});
