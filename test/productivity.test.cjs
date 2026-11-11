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
const { discoverLocalServers } = require('../src/main/infrastructure/local/server-discovery.cjs');
const { cacheArgs } = require('../src/main/domain/providers/local-server.cjs');
function fixture(provider) {
  const repos = createRepositories(openDatabase(':memory:')),
    session = repos.sessions.create('Decisions', 'general');
  for (let i = 0; i < 14; i++) repos.entries.add(session.id, i % 2 ? 'assistant' : 'user', 'Decision ' + i);
  return {
    repos,
    id: session.id,
    compact: compactorFor(repos, {
      checkContext: async () => null,
      stream: provider || (async () => 'Earlier decisions, including launch on Friday.'),
    }),
  };
}
test('compaction changes model context without deleting searchable history; undo restores the prior context', async () => {
  const f = fixture();
  try {
    await f.compact.compact(f.id, {}, new AbortController().signal);
    assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 8);
    assert.equal(f.repos.sessions.get(f.id).entries.length, 14);
    assert.equal(f.repos.sessionSearch.list('Decision 0').length, 1);
    assert.match(f.repos.sessions.get(f.id).compaction.summary, /Friday/);
    f.compact.undo(f.id);
    assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 14);
    assert.equal(f.repos.sessions.get(f.id).compaction.summary, '');
  } finally {
    f.repos.db.close();
  }
});
test('evolving compaction carries prior memory and leaves eight recent entries; repeated undo is reversible', async () => {
  const calls = [];
  const f = fixture(async (_settings, messages) => {
    calls.push(messages);
    return 'Memory ' + calls.length;
  });
  try {
    await f.compact.compact(f.id, {}, AbortSignal.timeout(1000));
    for (let i = 0; i < 4; i++) f.repos.entries.add(f.id, 'user', 'New ' + i);
    await f.compact.compact(f.id, {}, AbortSignal.timeout(1000));
    assert.equal(calls[1].length, 1);
    assert.equal(calls[1][0].role, 'user');
    assert.match(calls[1][0].content, /CURRENT COMPACTED SUMMARY:\nMemory 1\n\nNEW TURNS/);
    assert.match(calls[1][0].content, /User: Decision 6/);
    assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 8);
    f.compact.undo(f.id);
    assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 12);
    assert.equal(f.repos.sessions.get(f.id).compaction.summary, 'Memory 1');
  } finally {
    f.repos.db.close();
  }
});
test('cancelled and simultaneous compactions cannot commit stale summaries', async () => {
  let release;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const controller = new AbortController();
  try {
    const pending = f.compact.compact(f.id, {}, controller.signal);
    await assert.rejects(f.compact.compact(f.id, {}, controller.signal), /already/);
    assert.throws(() => f.compact.undo(f.id), /finish/);
    controller.abort();
    release('Late memory');
    await assert.rejects(pending);
    assert.equal(f.repos.sessions.get(f.id).compaction.count, 0);
  } finally {
    f.repos.db.close();
  }
});
test('local compaction supplies complete selected entries and a short non-thinking response', async () => {
  let captured;
  const f = fixture(async (settings, messages) => {
    captured = { settings, messages };
    return 'Small memory';
  });
  try {
    const source = 'Unique decision ' + 'x'.repeat(1800) + ' END';
    f.repos.db.prepare('UPDATE entries SET content=? WHERE rowid=1').run(source);
    await f.compact.compact(f.id, { managedLocal: true }, AbortSignal.timeout(1000));
    assert.equal(captured.messages.length, 1);
    assert.ok(captured.messages[0].content.includes(`User: ${source}`));
    assert.equal(captured.settings.localVoice, true);
  } finally {
    f.repos.db.close();
  }
});
test('local discovery probes only fixed loopback endpoints without credentials or redirects', async () => {
  const calls = [];
  const results = await discoverLocalServers(async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        url.includes('11434') ? { models: [{ name: 'qwen3' }, { name: 8 }] } : { data: [{ id: 'local-model' }] },
      ),
    );
  });
  assert.deepEqual(
    results.map((r) => r.models),
    [['qwen3'], ['local-model']],
  );
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((c) => c.url.startsWith('http://127.0.0.1:') && c.options.redirect === 'error' && !c.options.headers),
  );
});
test('unavailable or oversized discovery replies are not treated as connected servers', async () => {
  const results = await discoverLocalServers(async (url) => {
    if (url.includes('11434')) throw Error('refused');
    return new Response('x'.repeat(1000001));
  });
  assert.ok(results.every((r) => !r.available && r.models.length === 0));
});
test('KV modes use explicit quantization and reject arbitrary server arguments', () => {
  assert.deepEqual(cacheArgs('off'), []);
  assert.deepEqual(cacheArgs('moderate'), ['--cache-type-k', 'q8_0', '--cache-type-v', 'q8_0', '--flash-attn', 'on']);
  assert.deepEqual(cacheArgs('aggressive').slice(0, 4), ['--cache-type-k', 'q4_0', '--cache-type-v', 'q4_0']);
  assert.throws(() => cacheArgs('--host=0.0.0.0'), /Unsupported/);
});
const { shortcutConfig } = require('../src/main/domain/settings/shortcuts.cjs');
const { ShortcutRegistry } = require('../src/main/infrastructure/electron/shortcut-registry.cjs');
const { createCopyWatcher } = require('../src/main/application/context/copy-watcher.cjs');
test('shortcut changes reject duplicate aliases, unknown actions and unmodified keys before touching registrations', () => {
  assert.throws(
    () =>
      shortcutConfig(
        JSON.stringify({
          capture: { accelerator: 'Command+Shift+J', enabled: true },
          ask: { accelerator: 'CommandOrControl+Shift+J', enabled: true },
        }),
        'darwin',
      ),
    /duplicated/,
  );
  assert.throws(() => shortcutConfig('{"unknown":{}}'), /Unknown/);
  assert.throws(() => shortcutConfig('{"hide":{"accelerator":"H"}}'), /Electron/);
  let registrations = [];
  const registry = new ShortcutRegistry(
    {
      // A key another app holds fails to register and so is never recorded.
      register: (key) => {
        if (key.endsWith('+D')) return false;
        registrations.push(key);
        return true;
      },
      unregister: (key) => {
        registrations = registrations.filter((k) => k !== key);
      },
    },
    () => {},
  );
  registry.configure('{}');
  const before = [...registrations];
  assert.throws(() => registry.configure('{'), /Invalid/);
  assert.deepEqual(registrations, before);
  registry.close();
  assert.equal(registrations.length, 0);
});
test('copy prompts require a new clipboard value matching a foreign selection and drop late results after disable', async () => {
  let clipboard = 'initial',
    selected = 'other',
    release;
  const events = [];
  let readSelection = async () => ({ text: selected });
  const watcher = createCopyWatcher({
    timers: { setInterval, clearInterval },
    readClipboard: () => clipboard,
    readSelection: () => readSelection(),
    onCopy: (value) => events.push(value),
    onError: () => {},
  });
  try {
    watcher.update('session', true);
    clipboard = 'password';
    await watcher.tick();
    assert.equal(events.length, 0);
    clipboard = 'Selected text';
    selected = 'Selected text';
    await watcher.tick();
    await watcher.tick();
    assert.equal(events.length, 1);
    readSelection = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    clipboard = 'new';
    const pending = watcher.tick();
    await new Promise(setImmediate);
    watcher.close();
    release({ text: 'new' });
    await pending;
    assert.equal(events.length, 1);
  } finally {
    watcher.close();
  }
});
test('Gemini audio uses its own host/key header, stateless request, and only completed model text', async () => {
  const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
  let request;
  const provider = new Providers(
    async (id) => {
      assert.equal(id, 'gemini');
      return 'fixture-key';
    },
    async (url, input) => {
      request = { url, input, body: JSON.parse(input.body) };
      return new Response(
        JSON.stringify({
          status: 'completed',
          steps: [
            { type: 'thought', content: [{ type: 'text', text: 'Hidden' }] },
            { type: 'model_output', content: [{ type: 'text', text: 'Spoken words' }] },
          ],
        }),
      );
    },
  );
  assert.equal(
    await provider.transcribe(
      { transcriptionProvider: 'gemini', transcriptionModel: 'gemini-3.8-flash' },
      Buffer.from([1, 2]),
      'audio/wav',
      AbortSignal.timeout(1000),
    ),
    'Spoken words',
  );
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(request.input.headers['x-goog-api-key'], 'fixture-key');
  assert.equal(request.input.headers.Authorization, undefined);
  assert.equal(request.body.store, false);
  assert.equal(request.body.input[1].mime_type, 'audio/wav');
  assert.equal(request.input.redirect, 'error');
});
test('repeated local facts still use model compaction instead of a deduplication substitute', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return 'Launch Friday; Alex owns it.';
  });
  try {
    f.repos.db.prepare('UPDATE entries SET content=?').run('Launch on Friday. Owner Alex.');
    const result = await f.compact.compact(f.id, { managedLocal: true }, AbortSignal.timeout(1000));
    assert.equal(calls, 1);
    assert.equal(result.summary, 'Launch Friday; Alex owns it.');
    assert.equal(result.method, 'model');
    assert.equal(f.repos.sessions.get(f.id).entries.length, 14);
  } finally {
    f.repos.db.close();
  }
});
test('a non-shrinking model summary cannot replace unique original context', async () => {
  const f = fixture(async () => 'a'.repeat(1000));
  try {
    await assert.rejects(f.compact.compact(f.id, {}, AbortSignal.timeout(1000)), /shorter memory/);
    assert.equal(f.repos.sessions.get(f.id).compaction.count, 0);
  } finally {
    f.repos.db.close();
  }
});
