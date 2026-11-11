const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSessionTitles } = require('../src/main/application/sessions/session-titles.cjs');

const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');

const conversation = [{ kind: 'transcript', speaker: 'THEY', content: 'Madrid is the capital of Spain.' }];

function harness({ rows, reply = async () => '"Capital of Spain."', backfilled = false, active = null } = {}) {
  const store = new Map(rows.map((row) => [row.id, { entries: conversation, ...row }]));
  const calls = { stream: 0, renamed: [], changes: 0, recorded: 0, logs: [] };
  const requests = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const titles = createSessionTitles({
    requests,
    sessions: {
      get: (id) => store.get(id),
      rename: (id, title) => {
        store.get(id).title = title;
        calls.renamed.push([id, title]);
      },
    },
    saved: ({ offset, limit }) => [...store.values()].slice(offset, offset + limit),
    activeId: () => active,
    settings: () => ({ uiLanguage: 'en', sessionTitlesBackfilled: backfilled }),
    providers: {
      stream: async (settings, messages) => {
        calls.stream++;
        assert.equal(settings.generationFeature, 'tldr');
        return reply(messages, store);
      },
    },
    route: { run: (settings, work) => work(settings) },
    recordBackfill: () => calls.recorded++,
    changed: () => calls.changes++,
    log: (message) => calls.logs.push(message),
  });
  return {
    titles,
    store,
    calls,
    requests,
    setActive: (id) => {
      active = id;
    },
  };
}
const signal = () => new AbortController().signal;

test('an ended session with the default title is named from its conversation and published once', async () => {
  const { titles, store, calls } = harness({ rows: [{ id: 's1', title: 'Conversation · 11/2/2026' }] });
  assert.equal(await titles.title('s1', signal()), 'Capital of Spain');
  assert.equal(store.get('s1').title, 'Capital of Spain');
  assert.equal(calls.changes, 1);
});

test('a typed title, an empty session or a rename during the request is never replaced', async () => {
  const { titles, store, calls } = harness({
    rows: [
      { id: 'mine', title: 'Interview prep' },
      { id: 'empty', title: 'Conversa · 2/11/2026', entries: [] },
      { id: 'racing', title: 'Conversación · 2/11/2026' },
    ],
    reply: async (_messages, rows) => {
      rows.get('racing').title = 'Renamed meanwhile';
      return 'Generated';
    },
  });
  assert.equal(await titles.title('mine', signal()), null);
  assert.equal(await titles.title('empty', signal()), null);
  assert.equal(calls.stream, 0);
  assert.equal(await titles.title('racing', signal()), null);
  assert.equal(store.get('racing').title, 'Renamed meanwhile');
  assert.deepEqual(calls.renamed, []);
});

test('the backfill names saved untitled sessions once, skipping the live one, and records the pass', async () => {
  const { titles, calls } = harness({
    rows: [
      { id: 'old', title: 'Conversation · 10/30/2026' },
      { id: 'live', title: 'Conversation · 11/2/2026' },
      { id: 'named', title: 'Budget review' },
    ],
    active: 'live',
  });
  await titles.backfill(signal());
  assert.deepEqual(calls.renamed, [['old', 'Capital of Spain']]);
  assert.equal(calls.recorded, 1);
});

test('a backfill that names nothing is retried later, and a recorded pass never runs again', async () => {
  const failing = harness({
    rows: [{ id: 'old', title: 'Conversation · 10/30/2026' }],
    reply: async () => {
      throw new Error('Choose a model.');
    },
  });
  await failing.titles.backfill(signal());
  assert.equal(failing.calls.recorded, 0);
  assert.match(failing.calls.logs[0], /Choose a model/);
  const done = harness({ rows: [{ id: 'old', title: 'Conversation · 10/30/2026' }], backfilled: true });
  await done.titles.backfill(signal());
  assert.equal(done.calls.stream, 0);
});

test('backfill reaches default titles beyond the first two hundred saved sessions', async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({
    id: String(index),
    title: index < 200 ? 'Named session' : 'Conversation · 11/2/2026',
  }));
  const h = harness({ rows });
  await h.titles.backfill(signal());
  assert.deepEqual(h.calls.renamed, [['200', 'Capital of Spain']]);
});

test('title requests are registered once and cannot write after cancellation, deletion or resume', async () => {
  for (const reason of ['delete', 'quit', 'resume']) {
    let finish;
    const h = harness({
      rows: [{ id: 's1', title: 'Conversation · 11/2/2026' }],
      reply: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const pending = h.titles.title('s1', signal());
    assert.equal(h.requests.pending(), 1);
    assert.equal(await h.titles.title('s1', signal()), null);
    if (reason === 'delete') {
      h.requests.cancelSession('s1');
      h.store.delete('s1');
    }
    if (reason === 'quit') h.requests.cancelAll();
    if (reason === 'resume') h.setActive('s1');
    finish('Late answer');
    if (reason === 'resume') assert.equal(await pending, null);
    else await assert.rejects(pending, { name: 'AbortError' });
    assert.deepEqual(h.calls.renamed, []);
    assert.equal(h.requests.pending(), 0);
  }
});

test('a user rename is preserved even when the new text still resembles a default title', async () => {
  const h = harness({
    rows: [{ id: 's1', title: 'Conversation · 11/2/2026' }],
    reply: async (_messages, store) => {
      store.get('s1').title = 'Conversation · 11/3/2026';
      return 'Generated title';
    },
  });
  assert.equal(await h.titles.title('s1', signal()), null);
  assert.equal(h.store.get('s1').title, 'Conversation · 11/3/2026');
  assert.deepEqual(h.calls.renamed, []);
});
