const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { randomUUID } = require('node:crypto');
const { createCompactor } = require('../src/main/application/compaction/compact.cjs');
const compactorFor = (repos, providers) =>
  createCompactor({
    sessions: repos.sessions,
    compactions: repos.compactions,
    providers,
    now: () => new Date(),
    newId: randomUUID,
  });
const { prepareSessionContext } = require('../src/main/application/sessions/context-preparation.cjs');
const { ContextWindowError } = require('../src/main/domain/providers/context-budget.cjs');
const { compactionPrompt, newMessagesSince, outputLanguage } = require('../src/main/domain/sessions/compaction.cjs');

test('initial compaction formats roles and transcript speakers without substituting source placeholders', () => {
  const prompt = compactionPrompt({
    entries: [
      { kind: 'user', content: 'Keep ${conversationText} literally.' },
      { kind: 'assistant', content: 'Agreed.' },
      { kind: 'transcript', speaker: 'THEY', content: 'Friday.' },
    ],
    settings: { uiLanguage: 'pt-BR' },
  });
  assert.match(
    prompt,
    /Conversation to compact:\nUser: Keep \$\{conversationText\} literally\.\n\nAssistant: Agreed\.\n\n\[THEY\]: Friday\./,
  );
  assert.match(prompt, /required output language is Portuguese \(Brazilian\)/);
  assert.doesNotMatch(prompt, /CURRENT COMPACTED SUMMARY/);
});

test('evolving compaction preserves the previous summary and uses the configured output language', () => {
  const prompt = compactionPrompt({
    previousSummary: 'Owner Alex. Keep ${newContent}.',
    entries: [{ kind: 'user', content: 'Owner is now Jo.' }],
    settings: { uiLanguage: 'es' },
  });
  assert.match(prompt, /CURRENT COMPACTED SUMMARY:\nOwner Alex\. Keep \$\{newContent\}\.\n/);
  assert.match(prompt, /NEW TURNS \(since last compaction\):\nUser: Owner is now Jo\./);
  assert.match(prompt, /required output language is Spanish/);
});

test('new-message policy uses the observed entry sequence rather than wall-clock timestamps', () => {
  const current = { observed_through_rowid: 10, created_at: '2030-01-01' };
  const entries = [
    { sequence: 10, kind: 'user', created_at: '2031-01-01' },
    { sequence: 11, kind: 'transcript', created_at: '2020-01-01' },
    { sequence: 12, kind: 'user', created_at: '2020-01-01' },
    { sequence: 13, kind: 'assistant', created_at: '2020-01-01' },
  ];
  assert.equal(newMessagesSince(current, entries), 2);
  assert.equal(newMessagesSince(null, []), Infinity);
});

test('compaction language honors a saved preference and resolves the system-language fallback', () => {
  assert.equal(outputLanguage({ uiLanguage: 'pt-BR' }, 'es-MX'), 'Portuguese (Brazilian)');
  assert.equal(outputLanguage({ uiLanguage: '' }, 'pt_PT'), 'Portuguese (Brazilian)');
  assert.equal(outputLanguage({}, 'es-MX'), 'Spanish');
  assert.equal(outputLanguage({}, 'de-DE'), 'English');
});

test('legacy checkpoints retain their timestamp policy until a new checkpoint records its entry boundary', () => {
  assert.equal(
    newMessagesSince({ created_at: '2026-10-30T12:00:00.000Z' }, [
      { kind: 'user', created_at: '2026-10-30T11:59:59.999Z' },
      { kind: 'assistant', created_at: '2026-10-30T12:00:00.000Z' },
      { kind: 'user', created_at: '2026-10-30T12:00:00.001Z' },
    ]),
    1,
  );
});

function fixture(t) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const id = repos.sessions.create('Compaction policy', 'general').id;
  for (let i = 0; i < 14; i++) repos.entries.add(id, i % 2 ? 'assistant' : 'user', `Decision ${i}: keep context.`);
  let calls = 0;
  let overflow = false;
  const providers = {
    checkContext: async () => {
      if (overflow) {
        overflow = false;
        throw new ContextWindowError('Fixture capacity exceeded.');
      }
    },
    stream: async () => `Memory ${++calls}`,
  };
  const compactor = compactorFor(repos, providers);
  return {
    repos,
    id,
    compactor,
    overflow: () => {
      overflow = true;
    },
    calls: () => calls,
    prepare: () =>
      prepareSessionContext({
        repositories: repos,
        id,
        compactor,
        providers,
        mode: 'chat',
        question: 'Next?',
        settings: { autoCompact: true, compactThreshold: 1 },
        signal: AbortSignal.timeout(1000),
      }),
  };
}

test('threshold compaction waits for six new chat messages and resets after its checkpoint', async (t) => {
  const f = fixture(t);
  await f.prepare();
  assert.equal(f.calls(), 1);
  for (let i = 0; i < 5; i++) f.repos.entries.add(f.id, 'user', `New fact ${i}`);
  await f.prepare();
  assert.equal(f.calls(), 1);
  f.repos.entries.add(f.id, 'assistant', 'Sixth new chat message.');
  // Equal timestamps and a clock change must not change the message count.
  f.repos.db.prepare('UPDATE entries SET created_at=?').run('2020-01-01T00:00:00.000Z');
  await f.prepare();
  assert.equal(f.calls(), 2);
  assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 8);
  await f.prepare();
  assert.equal(f.calls(), 2);
  assert.equal(f.repos.sessions.get(f.id).entries.length, 20);
});

test('transcript lines do not satisfy the chat threshold but actual capacity overflow bypasses the gate', async (t) => {
  const f = fixture(t);
  await f.prepare();
  for (let i = 0; i < 6; i++) f.repos.entries.add(f.id, 'transcript', `Speech ${i}`, 'THEY');
  await f.prepare();
  assert.equal(f.calls(), 1);
  f.overflow();
  await f.prepare();
  assert.equal(f.calls(), 2);
  assert.equal(f.repos.sessions.get(f.id).entries.length, 20);
});

test('entries arriving during generation remain new after the checkpoint commits', async (t) => {
  const f = fixture(t);
  // Use the public compactor seam with a provider that writes a new entry before its answer resolves.
  const compactor = compactorFor(f.repos, {
    stream: async () => {
      f.repos.entries.add(f.id, 'user', 'Arrived while compacting.');
      return 'Prior decisions.';
    },
  });
  await compactor.compact(f.id, {}, AbortSignal.timeout(1000));
  const snapshot = f.repos.compactions.snapshot(f.id);
  assert.equal(newMessagesSince(snapshot.current, snapshot.entries), 1);
  assert.equal(snapshot.entries.at(-1).content, 'Arrived while compacting.');
});

test('cloud compaction reads the complete selected entry and retains its final fact', async (t) => {
  const f = fixture(t);
  const source = 'Decision ' + 'x'.repeat(17000) + ' FINAL FACT';
  f.repos.db.prepare('UPDATE entries SET content=? WHERE rowid=1').run(source);
  let prompt;
  const compactor = compactorFor(f.repos, {
    stream: async (_settings, messages) => {
      prompt = messages[0].content;
      return 'Decision with final fact.';
    },
  });
  await compactor.compact(f.id, {}, AbortSignal.timeout(1000));
  assert.ok(prompt.includes(source));
  assert.equal(f.repos.sessions.get(f.id).entries[0].content, source);
});

test('oversized cloud source and an already cancelled request never reach generation or commit', async (t) => {
  const f = fixture(t);
  f.repos.db.prepare('UPDATE entries SET content=? WHERE rowid=1').run('x'.repeat(50001));
  await assert.rejects(f.compactor.compact(f.id, {}, AbortSignal.timeout(1000)), /source limit/);
  await assert.rejects(f.compactor.compact(f.id, {}, AbortSignal.abort()), { name: 'AbortError' });
  assert.equal(f.calls(), 0);
  assert.equal(f.repos.sessions.get(f.id).compaction.count, 0);
  assert.equal(f.compactor.busy.size, 0);
});
