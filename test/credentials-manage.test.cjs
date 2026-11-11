const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { credentialVault } = require('../src/main/infrastructure/credentials/safe-storage.cjs');
const { createCredentials } = require('../src/main/application/credentials/manage.cjs');

function harness(t, { available = true } = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const keychain = {
    isAsyncEncryptionAvailable: async () => available,
    encryptStringAsync: async (value) => Buffer.from(`sealed:${value}`),
    decryptStringAsync: async (bytes) => ({ result: bytes.toString().replace(/^sealed:/, '') }),
  };
  const state = { changes: 0 },
    vault = credentialVault({
      credentials: repos.credentials,
      safeStorage: keychain,
      timers: { setTimeout: () => 1, clearTimeout() {} },
    });
  return { repos, state, vault, credentials: createCredentials({ vault, changed: () => state.changes++ }) };
}

test('keys are sealed before storage and only their status is returned', async (t) => {
  const { repos, state, vault, credentials } = harness(t);
  const status = await credentials.saveKey({ provider: 'openai', key: 'sk-test' });
  assert.equal(JSON.stringify(status).includes('sk-test'), false);
  assert.equal(Buffer.from(repos.credentials.get('openai')).toString(), 'sealed:sk-test');
  assert.equal(await vault.read('openai'), 'sk-test');
  assert.equal(state.changes, 1);
});

test('reserved providers and oversized keys are refused without publishing', async (t) => {
  const { state, credentials } = harness(t);
  await assert.rejects(() => credentials.saveKey({ provider: 'chatgpt', key: 'x' }), /Continue with ChatGPT/);
  await assert.rejects(() => credentials.saveKey({ provider: 'customHeaders', key: 'x' }), /custom provider settings/);
  await assert.rejects(() => credentials.saveKey({ provider: 'openai', key: 'x'.repeat(20001) }), /Invalid key/);
  assert.equal(state.changes, 0);
});

test('without encryption a key cannot be saved but can still be cleared', async (t) => {
  const { state, vault, credentials } = harness(t, { available: false });
  await assert.rejects(
    () => credentials.saveKey({ provider: 'openai', key: 'sk-test' }),
    /secure credential storage is unavailable/,
  );
  assert.equal(state.changes, 0);
  await credentials.saveKey({ provider: 'openai', key: '' });
  assert.equal(await vault.read('openai'), '');
  assert.equal(state.changes, 1);
});

test('custom headers expose names only and keep values for the providers', async (t) => {
  const { credentials } = harness(t);
  assert.deepEqual(await credentials.saveHeaders([{ key: 'X-Team', value: 'secret-team' }]), ['X-Team']);
  assert.deepEqual(credentials.headerNames(), ['X-Team']);
  assert.deepEqual(
    (await credentials.headers()).map((item) => item.value),
    ['secret-team'],
  );
});

test('public header names return immediately while a Keychain read is pending, then publish names only', async () => {
  let resolveRead;
  const events = [];
  const credentials = createCredentials({
    vault: {
      read: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    },
    changed: () => events.push('changed'),
  });
  assert.deepEqual(credentials.headerNames(), []);
  resolveRead(JSON.stringify([{ key: 'X-Team', value: 'fixture value' }]));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(credentials.headerNames(), ['X-Team']);
  assert.deepEqual(events, ['changed']);
});
test('failed encryption does not publish a saved key or header set', async () => {
  const events = [];
  const credentials = createCredentials({
    vault: {
      read: async () => '',
      write: async () => {
        throw new Error('Keychain declined');
      },
    },
    changed: () => events.push('changed'),
  });
  await assert.rejects(credentials.saveKey({ provider: 'openai', key: 'fixture value' }), /declined/);
  await assert.rejects(credentials.saveHeaders([{ key: 'X-Team', value: 'fixture value' }]), /declined/);
  assert.deepEqual(events, []);
});
test('a late header-name load cannot replace a newly saved header set', async () => {
  let resolveRead;
  const credentials = createCredentials({
    vault: {
      read: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      write: async () => {},
    },
    changed() {},
  });
  credentials.headerNames();
  await credentials.saveHeaders([]);
  resolveRead(JSON.stringify([{ key: 'X-Old', value: 'old fixture value' }]));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(credentials.headerNames(), []);
});

test('invalid header input does not invalidate a pending public-name load', async () => {
  let resolveRead;
  const credentials = createCredentials({
    vault: {
      read: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    },
    changed() {},
  });
  assert.deepEqual(credentials.headerNames(), []);
  await assert.rejects(credentials.saveHeaders({}), /at most/);
  resolveRead(JSON.stringify([{ key: 'X-Kept', value: 'fixture value' }]));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(credentials.headerNames(), ['X-Kept']);
});
