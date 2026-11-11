const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHeaders, mergeHeaders } = require('../src/main/domain/providers/custom-headers.cjs');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');

const stream = () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'),
        );
        controller.close();
      },
    }),
  );

test('custom headers validate names, values, duplicates and reserved transport headers', () => {
  assert.deepEqual(normalizeHeaders([{ key: ' X-Api-Key ', value: ' fixture ' }]), [
    { key: 'X-Api-Key', value: 'fixture' },
  ]);
  for (const input of [
    [{ key: 'Bad Name', value: 'x' }],
    [{ key: '', value: 'x' }],
    [{ key: 'X-A', value: 'line\r\nInjected: yes' }],
    [{ key: 'Content-Type', value: 'text/plain' }],
    [{ key: 'host', value: 'example.com' }],
    [
      { key: 'X-A', value: '1' },
      { key: 'x-a', value: '2' },
    ],
    [{ key: 'X-A', value: 'v'.repeat(4097) }],
    Array.from({ length: 21 }, (_, i) => ({ key: 'X-' + i, value: 'v' })),
    'not-a-list',
  ])
    assert.throws(() => normalizeHeaders(input));
  assert.throws(() => normalizeHeaders([{ key: 'X-New', value: null }]), /Enter a value/);
});
test('a null value keeps the saved secret for the same header name', () => {
  const saved = [{ key: 'X-Api-Key', value: 'stored-secret' }];
  assert.deepEqual(
    normalizeHeaders(
      [
        { key: 'x-api-key', value: null },
        { key: 'X-Team', value: 'blue' },
      ],
      saved,
    ),
    [
      { key: 'x-api-key', value: 'stored-secret' },
      { key: 'X-Team', value: 'blue' },
    ],
  );
});
test('merge overrides defaults case-insensitively', () => {
  assert.deepEqual(
    mergeHeaders({ 'Content-Type': 'application/json', Authorization: 'Bearer key' }, [
      { key: 'authorization', value: 'Token custom' },
      { key: 'X-Team', value: 'blue' },
    ]),
    { 'Content-Type': 'application/json', authorization: 'Token custom', 'X-Team': 'blue' },
  );
});
test('custom provider chat and model requests carry the headers; other providers and managed local do not', async () => {
  const requests = [];
  const providers = new Providers(
    async () => 'fixture-key',
    async (url, options) => {
      url = String(url);
      requests.push({ url, headers: options.headers });
      if (url.endsWith('/apply-template')) return Response.json({ prompt: 'Hi' });
      if (url.endsWith('/tokenize')) return Response.json({ tokens: [1, 2] });
      return url.endsWith('/models') ? Response.json({ data: [{ id: 'm' }] }) : stream();
    },
    async () => [
      { key: 'X-Team', value: 'blue' },
      { key: 'Authorization', value: 'Token custom' },
    ],
  );
  const custom = { ...DEFAULTS, provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', model: 'm' };
  assert.equal(await providers.stream(custom, [{ role: 'user', content: 'Hi' }], () => {}), 'ok');
  assert.equal(requests[0].url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(requests[0].headers['X-Team'], 'blue');
  assert.equal(requests[0].headers.Authorization, 'Token custom');
  assert.equal(requests[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(await providers.models(custom), ['m']);
  assert.equal(requests[1].url, 'http://localhost:11434/v1/models');
  assert.equal(requests[1].headers['X-Team'], 'blue');
  await providers.stream({ ...DEFAULTS, provider: 'openai', model: 'm' }, [{ role: 'user', content: 'Hi' }], () => {});
  assert.equal(requests[2].headers['X-Team'], undefined);
  assert.equal(requests[2].headers.Authorization, 'Bearer fixture-key');
  assert.equal(
    await providers.stream({ ...custom, managedLocal: true }, [{ role: 'user', content: 'Hi' }], () => {}),
    'ok',
  );
  assert.deepEqual(requests.slice(3), [
    { url: 'http://localhost:11434/apply-template', headers: { 'Content-Type': 'application/json' } },
    { url: 'http://localhost:11434/tokenize', headers: { 'Content-Type': 'application/json' } },
    { url: 'http://localhost:11434/v1/chat/completions', headers: { 'Content-Type': 'application/json' } },
  ]);
});
