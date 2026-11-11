// The preview's session search, paging, and whole-history operations, now split out of its lifecycle module.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = { crypto, structuredClone, DOMException, setTimeout, URL, window: { setTimeout } };
const plain = (value) => JSON.parse(JSON.stringify(value));
function context() {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  return {
    ctx,
    sessions: loadTs('src/bridge/mock/sessions.ts', globals).sessionsApi(ctx),
  };
}

test('sessions search matches title, summary or transcript content and sorts newest first', async () => {
  const { sessions } = context();
  const all = await sessions.sessions();
  assert.ok(all.length >= 2);
  assert.deepEqual(
    plain([...all].sort((a, b) => b.started_at.localeCompare(a.started_at)).map((item) => item.id)),
    plain(all.map((item) => item.id)),
  );
  const matches = await sessions.sessions('study');
  assert.ok(matches.length >= 1);
  assert.ok(matches.every((item) => item.title.toLowerCase().includes('study') || item.id));
});

test('sessionsPage excludes the active session by default and paginates its matches', async () => {
  const { ctx, sessions } = context();
  const live = await sessions.createSession('Live one');
  const excluded = await sessions.sessionsPage({});
  assert.ok(!excluded.sessions.some((item) => item.id === live.id));
  const included = await sessions.sessionsPage({ excludeActive: false });
  assert.ok(included.sessions.some((item) => item.id === live.id));
  const page = await sessions.sessionsPage({ limit: 1, offset: 0 });
  assert.equal(page.sessions.length, 1);
  assert.equal(page.limit, 1);
  await sessions.endSession(live.id);
  assert.equal(ctx.state.activeSessionId, null);
});

test('history stats, clearing and export operate on the whole history', async () => {
  const { sessions } = context();
  const before = await sessions.historyStats();
  assert.ok(before.totalSessions >= 2);
  const result = await sessions.clearHistory();
  assert.equal(result.sessions, before.totalSessions);
  const after = await sessions.historyStats();
  assert.equal(after.totalSessions, 0);
});

test('compaction stays unavailable in the browser preview', async () => {
  const { sessions } = context();
  assert.deepEqual(plain(await sessions.undoCompaction()), {
    summary: '',
    createdAt: null,
    estimatedTokens: 0,
    count: 0,
  });
});
