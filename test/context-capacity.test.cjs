const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
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
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { ContextWindowError } = require('../src/main/domain/providers/context-budget.cjs');
const settings = {
  ...DEFAULTS,
  provider: 'custom',
  managedLocal: true,
  contextSize: 2048,
  model: 'fixture',
  customBaseUrl: 'http://127.0.0.1:12345/v1',
};
const signal = () => AbortSignal.timeout(10000);
function event(delta) {
  return new Response('data: ' + JSON.stringify({ choices: [{ delta }] }) + '\n\ndata: [DONE]\n\n');
}
function harness(options = {}) {
  const requests = [];
  const providers = new Providers(
    () => {
      throw new Error('Managed request accessed credentials');
    },
    async (url, input) => {
      const endpoint = new URL(url).pathname,
        body = JSON.parse(input.body);
      requests.push({ endpoint, body, input });
      if (endpoint === '/apply-template')
        return Response.json({ prompt: options.template ? options.template(body) : JSON.stringify(body) });
      if (endpoint === '/tokenize')
        return Response.json({
          tokens: Array(
            typeof options.count === 'number'
              ? options.count
              : (options.count || ((text) => Math.ceil(text.length / 4)))(body.content),
          ).fill(7),
        });
      if (endpoint === '/v1/chat/completions')
        return options.completion ? options.completion(body) : event({ content: 'Compact memory.' });
      throw new Error('Unexpected fixture endpoint');
    },
  );
  return { providers, requests };
}
function sessionFixture(t, count = 18, length = 400, options = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  // A short assistant keeps the token arithmetic independent of the built-in catalog's prompt lengths.
  const assistant = repos.assistants.save({ name: 'Capacity assistant', prompt: 'Answer from the session.' });
  const id = repos.sessions.create('Capacity fixture', assistant).id;
  for (let i = 0; i < count; i++)
    repos.entries.add(id, i % 2 ? 'assistant' : 'user', `Unique entry ${i} ` + 'x'.repeat(length));
  const h = harness(options),
    compactor = compactorFor(repos, h.providers);
  const prepare = (overrides = {}) =>
    prepareSessionContext({
      repositories: repos,
      compactor,
      providers: h.providers,
      id,
      mode: 'chat',
      question: 'What did we decide?',
      settings: { ...settings, autoCompact: true },
      signal: signal(),
      ...overrides,
    });
  return { ...h, repos, id, compactor, prepare };
}

test('local context setting validates boundaries and survives restart', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'context-settings-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.sqlite'),
    repos = createRepositories(openDatabase(file));
  assert.equal(repos.settings.read().localContextSize, 4096);
  for (const value of [512, 131072])
    assert.equal(validateSettings({ localContextSize: value }).localContextSize, value);
  for (const value of [511, 131073, NaN, Infinity, 4096.5, '4096'])
    assert.throws(() => validateSettings({ localContextSize: value }));
  repos.settings.update({ localContextSize: 2048 });
  repos.db.close();
  const reopened = createRepositories(openDatabase(file));
  t.after(() => reopened.db.close());
  assert.equal(reopened.settings.read().localContextSize, 2048);
});

test('owned runtime exposes the lower server capacity through state and leases', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'context-runtime-'));
  let argv, child;
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    fetch: (url, input) =>
      url.endsWith('/props')
        ? Promise.resolve(Response.json({ default_generation_settings: { n_ctx: 1024 }, total_slots: 1 }))
        : fetch(url, input),
    spawn: (_binary, args, input) => {
      argv = args;
      child = spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...args], input);
      return child;
    },
  });
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, 'fixture.gguf');
  await fs.writeFile(source, 'GGUF fixture');
  const model = await manager.importFile('llm', source);
  await manager.setBinary('llm', process.execPath);
  await manager.start(model.id, { localContextSize: 2048 });
  assert.equal(argv[argv.indexOf('-c') + 1], '2048');
  assert.equal(argv[argv.indexOf('--parallel') + 1], '1');
  assert.equal(manager.state().runtimes.llm.requestedContextSize, 2048);
  assert.equal(manager.state().runtimes.llm.contextSize, 1024);
  const lease = manager.acquire('llm');
  assert.equal(lease.contextSize, 1024);
  lease.release();
  lease.release();
  assert.equal(manager.runtimes.llm.users, 0);
  await manager.stop('llm');
  assert.notEqual(child.exitCode, null);
  manager.fetch = (url, input) =>
    url.endsWith('/props')
      ? Promise.resolve(Response.json({ default_generation_settings: { n_ctx: 0 }, total_slots: 1 }))
      : fetch(url, input);
  await assert.rejects(manager.start(model.id), /valid context capacity/);
  assert.equal(manager.state().runtimes.llm.status, 'stopped');
  assert.equal(manager.runtimes.llm.child, null);
});

test('managed completion reserves output and accepts the exact tokenizer boundary', async () => {
  const h = harness({ count: 1408 });
  assert.equal(
    await h.providers.stream(
      settings,
      [
        { role: 'system', content: 'Rules' },
        { role: 'user', content: 'Olá 世界' },
      ],
      () => {},
      signal(),
    ),
    'Compact memory.',
  );
  const [template, tokens, completion] = h.requests;
  assert.deepEqual(template.body.messages, completion.body.messages);
  assert.deepEqual(template.body.chat_template_kwargs, completion.body.chat_template_kwargs);
  assert.equal(tokens.body.add_special, false);
  assert.equal(tokens.body.parse_special, true);
  assert.equal(completion.body.max_tokens, 512);
  assert.equal(completion.body.chat_template_kwargs.enable_thinking, false);
  assert.equal(
    h.requests.every(
      (request) => request.input.headers.Authorization === undefined && request.input.redirect === 'error',
    ),
    true,
  );
  const budget = await h.providers
    .checkContext({ ...settings, contextSize: 512, localVoice: true }, [{ role: 'user', content: 'short' }], signal())
    .catch((error) => error.budget);
  assert.equal(budget.outputTokens, 128);
  assert.equal(budget.inputTokens, 256);
});

test('managed completion rejects tokenizer overflow before generation', async () => {
  const h = harness({ count: 1409 });
  await assert.rejects(
    h.providers.stream(settings, [{ role: 'user', content: 'short' }], () => {}, signal()),
    (error) =>
      error instanceof ContextWindowError && error.budget.promptTokens === 1409 && error.budget.inputTokens === 1408,
  );
  assert.deepEqual(
    h.requests.map((request) => request.endpoint),
    ['/apply-template', '/tokenize'],
  );
});

test('local completion rejects an oversized tool result before a second generation', async () => {
  let generations = 0,
    toolCalls = 0;
  const h = harness({
    completion: () => {
      generations++;
      return event({ tool_calls: [{ index: 0, id: 'call-fixture', function: { name: 'lookup', arguments: '{}' } }] });
    },
  });
  const tools = [{ name: 'lookup', description: 'Find records', parameters: { type: 'object', properties: {} } }];
  await assert.rejects(
    h.providers.stream(settings, [{ role: 'user', content: 'Find it' }], () => {}, signal(), undefined, {
      tools,
      handleTool: async () => {
        toolCalls++;
        return { text: 'x'.repeat(10000) };
      },
    }),
    ContextWindowError,
  );
  assert.equal(generations, 1);
  assert.equal(toolCalls, 1);
  const templates = h.requests.filter((request) => request.endpoint === '/apply-template');
  assert.equal(templates.length, 2);
  assert.equal(templates[1].body.messages.at(-1).role, 'tool');
  assert.equal(templates[0].body.tools[0].function.name, 'lookup');
});

test('unsafe local measurement fails closed and cancellation stops before inference', async () => {
  for (const malformed of [{ prompt: '' }, { prompt: 3 }, { tokens: [-1] }, { tokens: [1.5] }, { tokens: [] }]) {
    let completions = 0;
    const h = harness();
    h.providers.fetch = async (url) => {
      if (new URL(url).pathname === '/v1/chat/completions') completions++;
      return Response.json(
        Object.hasOwn(malformed, 'prompt')
          ? malformed
          : new URL(url).pathname === '/apply-template'
            ? { prompt: 'fixture' }
            : malformed,
      );
    };
    await assert.rejects(
      h.providers.stream(settings, [{ role: 'user', content: 'Hi' }], () => {}, signal()),
      /invalid/,
    );
    assert.equal(completions, 0);
  }
  const stripped = harness({ template: () => 'No tool definitions' });
  await assert.rejects(
    stripped.providers.checkContext(settings, [{ role: 'user', content: 'Hi' }], signal(), undefined, [
      { name: 'lookup', parameters: { type: 'object' } },
    ]),
    /did not include/,
  );
  const unsupported = harness();
  unsupported.providers.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(
    unsupported.providers.checkContext(settings, [{ role: 'user', content: 'Hi' }], signal()),
    /cannot measure/,
  );
  await assert.rejects(
    harness().providers.checkContext(
      { ...settings, customBaseUrl: 'https://remote.example/v1' },
      [{ role: 'user', content: 'Hi' }],
      signal(),
    ),
    /owned loopback/,
  );
  const cancelled = harness(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    cancelled.providers.checkContext(settings, [{ role: 'user', content: 'Hi' }], controller.signal),
    /abort/i,
  );
  assert.equal(cancelled.requests.length, 0);
  const pending = harness();
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  pending.providers.fetch = async (_url, input) =>
    new Promise((_resolve, reject) => {
      entered();
      input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
    });
  const active = new AbortController(),
    measurement = pending.providers.checkContext(settings, [{ role: 'user', content: 'Hi' }], active.signal);
  await started;
  active.abort();
  await assert.rejects(measurement, /abort/i);
});

test('external compatible providers do not use managed runtime measurement', async () => {
  const h = harness();
  h.providers.getKey = async () => '';
  assert.equal(
    await h.providers.stream(
      { ...settings, managedLocal: false },
      [{ role: 'user', content: 'Hi' }],
      () => {},
      signal(),
    ),
    'Compact memory.',
  );
  assert.deepEqual(
    h.requests.map((request) => request.endpoint),
    ['/v1/chat/completions'],
  );
  assert.equal(h.requests[0].body.max_tokens, 1500);
});

test('actual prompt capacity triggers compaction below the configured threshold', async (t) => {
  const f = sessionFixture(t);
  const before = f.repos.sessions.get(f.id).entries;
  assert.ok(f.repos.sessions.get(f.id).compaction.estimatedTokens < 12000);
  const messages = await f.prepare();
  assert.ok(f.repos.sessions.get(f.id).compaction.count > 0);
  assert.deepEqual(f.repos.sessions.get(f.id).entries, before);
  const recent = f.repos.compactions.snapshot(f.id).entries;
  assert.ok(recent.length >= 8 && recent.length < before.length);
  assert.deepEqual(
    recent.slice(-8).map((entry) => entry.id),
    before.slice(-8).map((entry) => entry.id),
  );
  assert.equal(messages.at(-1).content, 'What did we decide?');
  assert.match(messages[0].content, /Compact memory/);
  await f.providers.checkContext(settings, messages, signal());
  assert.equal(f.repos.sessionSearch.list('Unique entry 0').length, 1);
  f.compactor.undo(f.id);
  assert.equal(f.repos.compactions.snapshot(f.id).entries.length, 18);
});

test('irreducible or disabled compaction preserves history and never generates', async (t) => {
  const recent = sessionFixture(t, 8, 1000),
    before = recent.repos.sessions.get(recent.id);
  await assert.rejects(recent.prepare(), ContextWindowError);
  assert.deepEqual(recent.repos.sessions.get(recent.id), before);
  assert.equal(
    recent.requests.some((request) => request.endpoint === '/v1/chat/completions'),
    false,
  );
  const disabled = sessionFixture(t);
  await assert.rejects(disabled.prepare({ settings: { ...settings, autoCompact: false } }), ContextWindowError);
  assert.equal(disabled.repos.sessions.get(disabled.id).compaction.count, 0);
  const summary = sessionFixture(t);
  summary.repos.entries.add(summary.id, 'transcript', 'x'.repeat(10000), 'THEY');
  await assert.rejects(
    summary.prepare({ mode: 'summary', settings: { ...settings, autoCompact: false } }),
    ContextWindowError,
  );
  assert.equal(summary.repos.sessions.get(summary.id).compaction.count, 0);
});

test('a summary past the window reads session memory and compacts the transcript', async (t) => {
  const f = sessionFixture(t, 0);
  for (let i = 0; i < 30; i++) f.repos.entries.add(f.id, 'transcript', `Point ${i} ` + 'y'.repeat(400), 'THEY');
  const before = f.repos.sessions.get(f.id).entries;
  const full = await f.prepare({
    mode: 'summary',
    question: 'Summarize.',
    settings: { ...settings, autoCompact: true, contextSize: 131072 },
  });
  assert.match(full[0].content, /Point 0 /);
  assert.equal(f.repos.sessions.get(f.id).compaction.count, 0);
  const messages = await f.prepare({ mode: 'summary', question: 'Summarize.' });
  assert.ok(f.repos.sessions.get(f.id).compaction.count > 0);
  assert.match(messages[0].content, /Compact memory/);
  assert.doesNotMatch(messages[0].content, /Point 0 /);
  assert.match(messages[0].content, /Point 29 /);
  assert.deepEqual(f.repos.sessions.get(f.id).entries, before);
});

test('oversized compaction source cannot advance a partially read checkpoint', async (t) => {
  const f = sessionFixture(t, 14, 50),
    source = 'Unique giant source ' + 'z'.repeat(16000) + ' FINAL FACT';
  f.repos.db.prepare('UPDATE entries SET content=? WHERE rowid=1').run(source);
  const before = f.repos.sessions.get(f.id);
  await assert.rejects(f.compactor.compact(f.id, settings, signal()), ContextWindowError);
  assert.deepEqual(f.repos.sessions.get(f.id), before);
  assert.equal(
    f.requests.some((request) => request.endpoint === '/v1/chat/completions'),
    false,
  );
  const template = f.requests.find((request) => request.endpoint === '/apply-template');
  assert.ok(template.body.messages[0].content.includes(`User: ${source}`));
});

test('bounded compaction retains complete prior memory and preserves the newest eight entries', async (t) => {
  const f = sessionFixture(t, 28, 400),
    recentIds = f.repos.sessions
      .get(f.id)
      .entries.slice(-8)
      .map((entry) => entry.id);
  await f.prepare();
  assert.ok(f.repos.sessions.get(f.id).compaction.count >= 2);
  assert.deepEqual(
    f.repos.compactions
      .snapshot(f.id)
      .entries.slice(-8)
      .map((entry) => entry.id),
    recentIds,
  );
  const previous = 'Existing memory ' + 'p'.repeat(1700) + ' MEMORY TAIL';
  f.repos.db
    .prepare('UPDATE session_compactions SET content=? WHERE id=?')
    .run(previous, f.repos.compactions.snapshot(f.id).current.id);
  for (let i = 0; i < 4; i++) f.repos.entries.add(f.id, 'user', 'Another unique decision ' + i);
  await f.compactor.compact(f.id, settings, signal());
  const generations = f.requests.filter((request) => request.endpoint === '/v1/chat/completions');
  assert.ok(generations.at(-1).body.messages[0].content.includes(`CURRENT COMPACTED SUMMARY:\n${previous}\n`));
  assert.equal(f.repos.sessions.get(f.id).entries.length, 32);
});

test('failed or cancelled compaction measurement commits no memory', async (t) => {
  const f = sessionFixture(t),
    before = f.repos.sessions.get(f.id);
  f.providers.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(f.compactor.compact(f.id, settings, signal()), /cannot measure/);
  assert.deepEqual(f.repos.sessions.get(f.id), before);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.compactor.compact(f.id, settings, controller.signal), /abort/i);
  assert.deepEqual(f.repos.sessions.get(f.id), before);
  assert.equal(f.compactor.busy.size, 0);
});

test('session preparation rejects cancellation delivered by the completed preflight', async (t) => {
  const f = sessionFixture(t, 2, 20),
    before = f.repos.sessions.get(f.id),
    controller = new AbortController();
  let measurements = 0;
  f.providers.checkContext = async () => {
    measurements++;
    controller.abort();
    return null;
  };
  await assert.rejects(f.prepare({ signal: controller.signal }), /abort/i);
  assert.equal(measurements, 1);
  assert.deepEqual(f.repos.sessions.get(f.id), before);
  assert.equal(f.requests.length, 0);
});
