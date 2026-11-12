const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const {
  modelKind,
  redirectTarget,
  checkModelMagic,
  catalogOrigin,
  serverArgs,
  slotCapacity,
} = require('../src/main/domain/providers/local-server.cjs');
const { openCatalog } = require('../src/main/infrastructure/local/model-catalog-file.cjs');
const { fetchArtifact } = require('../src/main/infrastructure/local/model-download.cjs');
const { hashedCopy } = require('../src/main/infrastructure/local/hashed-copy.cjs');

const config = {
  contextSize: 8192,
  threads: 4,
  gpuLayers: 0,
  batchSize: 256,
  ubatchSize: 64,
  parallel: 2,
  warmup: false,
};

test('server arguments bind loopback and add vision and cache options only to language models', () => {
  const llm = serverArgs({
    type: 'llm',
    model: { id: 'm', projector: { sha256: 'x' } },
    modelFile: '/m.model',
    projectorFile: '/m.mmproj',
    port: 9,
    config,
    settings: { kvCacheMode: 'moderate' },
  });
  assert.deepEqual(llm.slice(0, 8), ['-m', '/m.model', '--host', '127.0.0.1', '--port', '9', '--alias', 'm']);
  assert.ok(llm.includes('--mmproj') && llm.includes('--cache-type-k'));
  assert.equal(llm[llm.indexOf('--image-max-tokens') + 1], '4096');
  assert.ok(!llm.includes('--api-key-file'), 'no api key file was given, so none is launched with');
  const whisper = serverArgs({
    type: 'whisper',
    model: { id: 'w' },
    modelFile: '/w',
    port: 9,
    settings: { localWhisperGpu: false },
  });
  assert.deepEqual(whisper.slice(-3), ['--language', 'auto', '--no-gpu']);
});

test('an api key file reaches llama-server by path only, and whisper-server never takes one', () => {
  const secret = 'f'.repeat(64);
  const llm = serverArgs({
    type: 'llm',
    model: { id: 'm' },
    modelFile: '/m.model',
    port: 9,
    config,
    settings: {},
    apiKeyFile: '/private/keys/llm.key',
  });
  assert.deepEqual(llm.slice(-2), ['--api-key-file', '/private/keys/llm.key']);
  assert.ok(!llm.some((arg) => arg.includes(secret)), 'the key itself never reaches the argument list');
  const whisper = serverArgs({
    type: 'whisper',
    model: { id: 'w' },
    modelFile: '/w',
    port: 9,
    settings: {},
    apiKeyFile: '/private/keys/whisper.key',
  });
  assert.ok(!whisper.includes('--api-key-file'), 'whisper-server launch stays unaffected by an api key file');
});

test('the slot capacity is the reported context bounded per slot', () => {
  assert.equal(slotCapacity({ default_generation_settings: { n_ctx: 8192 }, total_slots: 2 }, config), 4096);
  assert.equal(slotCapacity({ default_generation_settings: { n_ctx: 2048 }, total_slots: 2 }, config), 2048);
  assert.throws(
    () => slotCapacity({ default_generation_settings: { n_ctx: 2048 }, total_slots: 1 }, config),
    /valid context/,
  );
  assert.throws(() => slotCapacity({ total_slots: 2 }, config), /valid context/);
});

test('model formats, kinds, redirects and catalog ids are checked', () => {
  assert.doesNotThrow(() => checkModelMagic('llm', Buffer.from('GGUF')));
  assert.throws(() => checkModelMagic('llm', Buffer.from('GG')), /GGUF/);
  assert.throws(() => checkModelMagic('whisper', Buffer.from('ab')), /GGML/);
  assert.throws(() => modelKind('vision'), /LLM or Whisper/);
  assert.equal(redirectTarget('/next', new URL('https://example.com/a')).href, 'https://example.com/next');
  assert.throws(() => redirectTarget('http://example.com/x', new URL('https://example.com/a')), /unsupported URL/);
  assert.deepEqual(catalogOrigin({ id: 'qwen3-06b' }), { catalogId: 'qwen3-06b' });
  assert.deepEqual(catalogOrigin({ id: 'bad id' }), {});
});

test('opening the models directory clears partial files and refuses an unreadable catalog', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-catalog-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const partial = path.join(directory, '00000000-0000-0000-0000-000000000000.model.partial');
  fs.writeFileSync(partial, 'x');
  assert.deepEqual(openCatalog(directory).catalog, { models: [], binaries: {} });
  assert.equal(fs.existsSync(partial), false);
  fs.writeFileSync(path.join(directory, 'catalog.json'), '{broken');
  assert.throws(() => openCatalog(directory), /unreadable/);
});

test('a download follows HTTPS redirects and a copy reports its size, digest and magic', async () => {
  const calls = [];
  const artifact = await fetchArtifact(
    async (url) => {
      calls.push(String(url));
      return calls.length === 1
        ? new Response(null, { status: 302, headers: { location: '/real.gguf' } })
        : new Response('GGUF-data', { headers: { 'content-length': '9' } });
    },
    'https://example.com/model.gguf',
    new AbortController().signal,
  );
  assert.deepEqual(calls, ['https://example.com/model.gguf', 'https://example.com/real.gguf']);
  assert.equal(artifact.size, 9);
  const written = [];
  const copied = await hashedCopy(
    { writeFile: async (chunk) => written.push(chunk) },
    Readable.from([Buffer.from('GGUF-data')]),
    {
      signal: new AbortController().signal,
      maxBytes: 100,
      limitMessage: 'too big',
    },
  );
  assert.equal(copied.bytes, 9);
  assert.equal(copied.magic.toString(), 'GGUF');
  assert.equal(copied.sha256.length, 64);
  await assert.rejects(
    hashedCopy({ writeFile: async () => {} }, Readable.from([Buffer.alloc(10)]), {
      signal: new AbortController().signal,
      maxBytes: 5,
      limitMessage: 'too big',
    }),
    /too big/,
  );
});
