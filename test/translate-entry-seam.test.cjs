const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createModelRoute } = require('../src/main/application/runtime/model-route.cjs');
const { createEntryTranslator } = require('../src/main/application/sessions/translate-entry.cjs');

function harness(settings, translate = async () => ({ text: 'Olá' })) {
  const map = new Map(),
    leases = { acquired: 0, released: 0 },
    seen = [];
  const route = createModelRoute({
    acquireLocal: () => {
      leases.acquired++;
      return { contextSize: 4096, base: 'http://127.0.0.1:9', model: 'm', release: () => leases.released++ };
    },
  });
  const translator = createEntryTranslator({
    settings: () => settings,
    route,
    translation: () => ({
      translate: async (resolved, ...rest) => {
        seen.push(resolved);
        return translate(resolved, ...rest);
      },
    }),
  });
  const run = (language) =>
    createRequestRegistry({ requests: map, timers: { setTimeout, clearTimeout } }).run(
      { id: 't1', owner: 1, sessionId: 's1', mode: 'entryTranslation', timeoutMs: 90000 },
      (signal) => translator.translate({ sessionId: 's1', entryId: 'e1', language }, signal),
    );
  return { map, leases, seen, run };
}

test('a changed configured language is refused before any model is leased', async () => {
  const { map, leases, run } = harness({ provider: 'local', translationLanguage: 'es' });
  await assert.rejects(run('pt-BR'), /Translation language changed/);
  assert.deepEqual(leases, { acquired: 0, released: 0 });
  assert.equal(map.size, 0);
});

test('translation that is off is refused before any model is leased', async () => {
  const { map, leases, run } = harness({ provider: 'local', translationLanguage: '' });
  await assert.rejects(run(''), /Translation is off/);
  assert.deepEqual(leases, { acquired: 0, released: 0 });
  assert.equal(map.size, 0);
});

test('a dedicated translation provider replaces the main one', async () => {
  const { seen, leases, run } = harness({
    provider: 'local',
    model: 'main',
    translationLanguage: 'pt-BR',
    translationProvider: 'openai',
    translationModel: 'translator',
  });
  assert.deepEqual(await run('pt-BR'), { text: 'Olá' });
  assert.equal(seen[0].provider, 'openai');
  assert.equal(seen[0].model, 'translator');
  assert.deepEqual(leases, { acquired: 0, released: 0 });
});

test('a local translation releases its lease even when the source changed mid-request', async () => {
  const { map, leases, run } = harness({ provider: 'local', translationLanguage: 'pt-BR' }, async () => {
    throw new Error('The entry changed. Try again.');
  });
  await assert.rejects(run('pt-BR'), /entry changed/);
  assert.deepEqual(leases, { acquired: 1, released: 1 });
  assert.equal(map.size, 0);
});
