const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChatGPTAccounts } = require('../src/main/application/credentials/chatgpt-accounts.cjs');

function harness({ login = async () => ({ ok: true }), provider = 'chatgpt' } = {}) {
  const calls = [];
  let model = 'gpt-x';
  const accounts = createChatGPTAccounts({
    auth: {
      state: async () => {
        calls.push('state');
        return { accounts: ['a'], activeId: 'a', pending: false };
      },
      login: async (id) => {
        calls.push(`login:${id}`);
        return login();
      },
      cancel: () => calls.push('cancel'),
      select: async (id) => {
        calls.push(`select:${id}`);
        return { accounts: ['a', 'b'], activeId: id, pending: false };
      },
      logout: async (id) => {
        calls.push(`logout:${id}`);
        return { revoked: true, state: { accounts: [], activeId: null, pending: false } };
      },
    },
    requests: { cancelAll: () => calls.push('cancel-requests') },
    settings: {
      current: () => ({ provider }),
      clearModel: () => {
        model = '';
        calls.push('clear-model');
      },
    },
    changed: () => calls.push('publish'),
  });
  return { accounts, calls, model: () => model };
}

test('a failed sign-in still refreshes the status and publishes, without cancelling requests', async () => {
  const { accounts, calls } = harness({
    login: async () => {
      throw new Error('Browser closed.');
    },
  });
  await assert.rejects(accounts.login('a'), /Browser closed/);
  assert.deepEqual(calls, ['login:a', 'state', 'publish']);
  assert.equal(accounts.status().activeId, 'a');
});

test('a successful sign-in cancels running requests before the status refresh', async () => {
  const { accounts, calls } = harness();
  await accounts.login('a');
  assert.deepEqual(calls, ['login:a', 'cancel-requests', 'state', 'publish']);
});

test('switching account cancels requests first and resets the ChatGPT model', async () => {
  const { accounts, calls, model } = harness();
  assert.equal((await accounts.select('b')).activeId, 'b');
  assert.deepEqual(calls, ['cancel-requests', 'select:b', 'clear-model', 'publish']);
  assert.equal(model(), '');
  const other = harness({ provider: 'openai' });
  await other.accounts.select('b');
  assert.equal(other.model(), 'gpt-x');
});

test('logout cancels requests, stores the returned state and never exposes tokens', async () => {
  const { accounts, calls } = harness();
  const result = await accounts.logout('a');
  assert.deepEqual(calls, ['cancel-requests', 'logout:a', 'publish']);
  assert.deepEqual(accounts.status(), { accounts: [], activeId: null, pending: false });
  assert.doesNotMatch(JSON.stringify(result), /token/i);
});

test('a keychain that refuses the stored sign-in leaves ChatGPT signed out at startup instead of failing', async () => {
  const logged = [];
  const accounts = createChatGPTAccounts({
    auth: {
      state: async () => {
        throw new Error('Decryption is not available.');
      },
    },
    requests: { cancelAll: () => {} },
    settings: { current: () => ({ provider: 'chatgpt' }), clearModel: () => {} },
    changed: () => {},
    log: (message) => logged.push(message),
  });
  assert.deepEqual(await accounts.restore(), { accounts: [], activeId: null, pending: false });
  assert.deepEqual(logged, ['ChatGPT sign-in could not be restored: Decryption is not available.']);
  await assert.rejects(accounts.refresh(), /Decryption is not available/);
});
