const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
async function setup(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'local-model-test-'));
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, options);
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { manager, directory };
}
const data = Buffer.from('GGUF fixture model bytes');
const digest = createHash('sha256').update(data).digest('hex');
test('model downloads verify publisher digest; mismatches and interrupted bodies leave no catalog entry or partial file', async (t) => {
  const { manager, directory } = await setup(t, { fetch: async () => new Response(data) });
  await assert.rejects(
    manager.download({ kind: 'llm', url: 'https://models.example/m.gguf', sha256: '0'.repeat(64) }),
    /mismatch/,
  );
  assert.deepEqual(await fs.readdir(path.join(directory, 'models')), []);
  const model = await manager.download({
    id: 'reference-text',
    kind: 'llm',
    url: 'https://models.example/m.gguf',
    sha256: digest,
    name: 'Example',
  });
  assert.equal(model.sha256, digest);
  assert.equal(model.catalogId, 'reference-text');
  assert.notEqual(model.id, model.catalogId);
  const reopened = new LocalModels(path.join(directory, 'models'));
  t.after(() => reopened.close());
  assert.equal(reopened.state().models[0].catalogId, 'reference-text');
  assert.equal(reopened.state().models[0].id, model.id);
  assert.equal(await manager.verify(model.id), true);
  await fs.appendFile(manager.modelPath(model), 'changed');
  await assert.rejects(manager.verify(model.id), /changed on disk/);
  await manager.remove(model.id);
  assert.equal(manager.state().models.length, 0);
  assert.deepEqual(await fs.readdir(path.join(directory, 'models')), ['catalog.json']);
});
test('cancelling an in-flight download discards temporary bytes and keeps the original import intact', async (t) => {
  const { manager, directory } = await setup(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  manager.fetch = async () =>
    new Response(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(data);
          await gate;
          controller.close();
        },
      }),
    );
  const pending = manager.download({ kind: 'llm', url: 'https://models.example/m', sha256: digest });
  await new Promise((resolve) => setTimeout(resolve, 20));
  manager.cancel('llm');
  release();
  await assert.rejects(pending, /abort/i);
  assert.deepEqual(await fs.readdir(path.join(directory, 'models')), []);
  const original = path.join(directory, 'original.gguf');
  await fs.writeFile(original, data);
  const model = await manager.importFile('llm', original);
  await manager.remove(model.id);
  assert.deepEqual(await fs.readFile(original), data);
});
test('owned servers become ready, reject duplicate starts, survive catalog restart and stop before deleting models', async (t) => {
  let launched;
  const { manager, directory } = await setup(t, {
    spawn: (binary, args, options) => {
      assert.equal(options.shell, false);
      assert.equal(args[args.indexOf('--host') + 1], '127.0.0.1');
      assert.equal(options.env.LLAMA_ARG_HOST, undefined);
      launched = spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...args], options);
      return launched;
    },
  });
  const original = path.join(directory, 'model.gguf');
  await fs.writeFile(original, data);
  const model = await manager.importFile('llm', original);
  await manager.setBinary('llm', process.execPath);
  await manager.start(model.id);
  assert.equal(manager.state().runtimes.llm.status, 'running');
  await assert.rejects(manager.start(model.id), /Stop/);
  await assert.rejects(manager.remove(model.id), /Stop/);
  const lease = manager.acquire('llm');
  assert.equal((await fetch(lease.base + '/health')).status, 200);
  lease.release();
  await manager.stop('llm');
  assert.notEqual(launched.exitCode, null);
  assert.throws(() => manager.acquire('llm'), /Start/);
  const reopened = new LocalModels(path.join(directory, 'models'));
  t.after(() => reopened.close());
  assert.equal(reopened.state().models[0].sha256, digest);
  assert.equal(reopened.state().binaries.llm, process.execPath);
});
test('idle shutdown waits for active request leases and failed server starts can recover', async (t) => {
  const { manager, directory } = await setup(t, {
    idleMs: 30,
    spawn: (_binary, args, options) =>
      spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...args], options),
  });
  const original = path.join(directory, 'm.gguf');
  await fs.writeFile(original, data);
  const model = await manager.importFile('llm', original);
  await manager.setBinary('llm', process.execPath);
  manager.spawn = () => spawn('/missing-executable', []);
  await assert.rejects(manager.start(model.id), /exited/);
  assert.equal(manager.state().runtimes.llm.status, 'stopped');
  manager.spawn = (_binary, args, options) =>
    spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...args], options);
  await manager.start(model.id);
  const lease = manager.acquire('llm');
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(manager.state().runtimes.llm.status, 'running');
  lease.release();
  for (let i = 0; i < 100 && manager.state().runtimes.llm.status !== 'stopped'; i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(manager.state().runtimes.llm.status, 'stopped');
});
test('managed local LLM requests never load or send saved custom-provider credentials', async () => {
  const provider = new Providers(
    () => {
      throw new Error('Saved credential was accessed');
    },
    async (url, options) => {
      assert.equal(options.headers.Authorization, undefined);
      if (url.pathname === '/apply-template') return Response.json({ prompt: 'Hello' });
      if (url.pathname === '/tokenize') return Response.json({ tokens: [1] });
      return new Response('data: {"choices":[{"delta":{"content":"Local answer"}}]}\n\ndata: [DONE]\n\n');
    },
  );
  const result = await provider.stream(
    { provider: 'custom', managedLocal: true, model: 'local', customBaseUrl: 'http://127.0.0.1:12345/v1' },
    [{ role: 'user', content: 'Hello' }],
    () => {},
    new AbortController().signal,
  );
  assert.equal(result, 'Local answer');
});
test('projector replacement preserves the previous verified pair when catalog persistence fails', async (t) => {
  const { manager, directory } = await setup(t, {
    spawn: (_binary, args, options) =>
      spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...args], options),
  });
  const main = path.join(directory, 'vision.gguf'),
    first = path.join(directory, 'first.gguf'),
    second = path.join(directory, 'second.gguf');
  await fs.writeFile(main, data);
  await fs.writeFile(first, Buffer.from('GGUF projector one'));
  await fs.writeFile(second, Buffer.from('GGUF projector two'));
  const model = await manager.importFile('llm', main);
  await manager.importProjector(model.id, first);
  const originalDigest = manager.state().models[0].projector.sha256,
    originalPath = manager.projectorPath(manager.catalog.models[0]);
  const persist = manager.persist.bind(manager);
  manager.persist = () => {
    throw new Error('catalog disk failure');
  };
  await assert.rejects(manager.importProjector(model.id, second), /catalog disk failure/);
  manager.persist = persist;
  assert.equal(manager.state().models[0].projector.sha256, originalDigest);
  assert.equal(await manager.verify(model.id), true);
  assert.equal((await fs.readFile(originalPath)).toString(), 'GGUF projector one');
  await manager.setBinary('llm', process.execPath);
  let args;
  manager.spawn = (_binary, argv, options) => {
    args = argv;
    return spawn(process.execPath, [path.join(__dirname, 'fixtures/local-server.cjs'), ...argv], options);
  };
  await manager.start(model.id);
  assert.equal(args[args.indexOf('--mmproj') + 1], originalPath);
  assert.equal(args[args.indexOf('--image-max-tokens') + 1], '2048');
  const lease = manager.acquire('llm');
  assert.equal(lease.vision, true);
  lease.release();
});
const projectorData = Buffer.from('GGUF fixture projector bytes');
const projectorDigest = createHash('sha256').update(projectorData).digest('hex');
const pair = {
  name: 'Vision fixture',
  url: 'https://models.example/vision.gguf',
  sha256: digest,
  bytes: data.length,
  projector: { url: 'https://models.example/vision-mmproj.gguf', sha256: projectorDigest, bytes: projectorData.length },
};
test('paired vision downloads install model and projector together with cumulative progress', async (t) => {
  const progress = [];
  const { manager } = await setup(t, {
    fetch: async (url) => new Response(String(url).includes('mmproj') ? projectorData : data),
  });
  manager.onChange = () => {
    const op = manager.operations.llm;
    if (op) progress.push([op.phase, op.bytes, op.total]);
  };
  const model = await manager.download({ ...pair, id: 'reference-vision' });
  const state = manager.state().models[0];
  assert.equal(state.available, true);
  assert.equal(state.projectorAvailable, true);
  assert.equal(state.vision, true);
  assert.equal(state.catalogId, 'reference-vision');
  assert.notEqual(state.id, state.catalogId);
  assert.equal(state.projector.sha256, projectorDigest);
  assert.equal(await manager.verify(model.id), true);
  assert.ok(progress.some(([phase]) => phase === 'downloading-projector'));
  const reported = progress.filter(([, , total]) => total > 0);
  assert.ok(
    reported.length &&
      reported.every(([, bytes, total]) => total === data.length + projectorData.length && bytes <= total),
  );
  await manager.remove(model.id);
  assert.equal(manager.state().models.length, 0);
});
test('a failed or cancelled projector leaves no installed model; an unpaired vision model cannot start', async (t) => {
  const { manager, directory } = await setup(t, {
    fetch: async (url) => (String(url).includes('mmproj') ? new Response(projectorData) : new Response(data)),
  });
  await assert.rejects(
    manager.download({ ...pair, projector: { ...pair.projector, sha256: '0'.repeat(64) } }),
    /Projector SHA-256 mismatch/,
  );
  assert.equal(manager.state().models.length, 0);
  assert.deepEqual(await fs.readdir(path.join(directory, 'models')), ['catalog.json']);
  manager.fetch = async (url) =>
    String(url).includes('mmproj') ? new Response('nope', { status: 404 }) : new Response(data);
  await assert.rejects(manager.download(pair), /HTTP 404/);
  assert.equal(manager.state().models.length, 0);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  manager.fetch = async (url) =>
    String(url).includes('mmproj')
      ? new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(projectorData.subarray(0, 4));
              await gate;
              controller.close();
            },
          }),
        )
      : new Response(data);
  const pending = manager.download(pair);
  for (let i = 0; i < 50 && manager.operations.llm?.phase !== 'downloading-projector'; i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  manager.cancel('llm');
  release();
  await assert.rejects(pending, /abort/i);
  assert.equal(manager.state().models.length, 0);
  assert.deepEqual(await fs.readdir(path.join(directory, 'models')), ['catalog.json']);
  manager.fetch = async (url) => new Response(String(url).includes('mmproj') ? projectorData : data);
  const model = await manager.download(pair);
  await fs.rm(manager.projectorPath(model));
  assert.equal(manager.state().models[0].available, false);
  await manager.setBinary('llm', process.execPath);
  await assert.rejects(manager.start(model.id), /needs its projector/);
});
test('stopping while a start is still verifying cancels it before any process launches', async (t) => {
  let spawned = 0;
  const { manager, directory } = await setup(t, {
    spawn: () => {
      spawned++;
      throw new Error('should not spawn');
    },
  });
  const original = path.join(directory, 'model.gguf');
  await fs.writeFile(original, data);
  const model = await manager.importFile('llm', original);
  await manager.setBinary('llm', process.execPath);
  manager.verify = async () => {
    const op = manager.begin('llm', 'verifying');
    try {
      await new Promise((_resolve, reject) =>
        op.controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      );
    } finally {
      delete manager.operations.llm;
    }
  };
  const starting = manager.start(model.id);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await manager.stop('llm');
  await assert.rejects(starting, (error) => error.name === 'AbortError');
  assert.equal(spawned, 0);
  assert.equal(manager.operations.llm, undefined);
});
test('removal reserves the model lifecycle and close waits for in-flight operations', async (t) => {
  const { manager, directory } = await setup(t);
  const original = path.join(directory, 'model.gguf');
  await fs.writeFile(original, data);
  const model = await manager.importFile('llm', original);
  const op = manager.begin('llm', 'verifying');
  await assert.rejects(manager.remove(model.id), /wait for model operations/);
  let closed = false;
  const closing = manager.close().then(() => {
    closed = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(closed, false, 'close waits for the operation to settle');
  assert.equal(op.controller.signal.aborted, true);
  delete manager.operations.llm;
  await closing;
  assert.equal(closed, true);
});

test('close waits for aborted operations and reports one that will not stop', async () => {
  const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-close-'));
  const logs = [],
    models = new LocalModels(path.join(directory, 'models'), () => {});
  Object.assign(models, { closeTimeoutMs: 100, log: (message) => logs.push(message) });
  try {
    const settling = models.begin('llm', 'importing');
    settling.controller.signal.addEventListener('abort', () =>
      setTimeout(() => {
        delete models.operations.llm;
      }, 20),
    );
    models.begin('whisper', 'downloading').controller.signal.addEventListener('abort', () => {});
    const result = await models.close();
    assert.equal(models.operations.llm, undefined, 'an operation that ends after abort is waited for');
    assert.deepEqual(result.pending, ['whisper downloading']);
    assert.match(logs[0], /still running at quit: whisper downloading/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
