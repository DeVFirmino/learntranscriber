const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChatGPTAuth } = require('../src/main/infrastructure/integrations/chatgpt-auth.cjs');

test('logout blocks token use immediately while remote revocation is still pending', async () => {
  const issuer = 'https://auth.openai.com';
  let saved = {
    hostId: 'urn:uuid:host',
    activeId: 'a1',
    accounts: {
      a1: {
        client_id: 'client',
        access_token: 'live-token',
        refresh_token: 'refresh',
        expiresAt: Date.now() + 3600000,
        scopes: ['openid'],
      },
    },
  };
  let release, revokedWith;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const manager = new ChatGPTAuth(
    async () => structuredClone(saved),
    async (data) => {
      saved = structuredClone(data);
    },
    async () => {},
    {
      fetch: async (url, options) => {
        const target = String(url);
        if (target.endsWith('/.well-known/openid-configuration'))
          return Response.json({ issuer, jwks_uri: issuer + '/jwks', revocation_endpoint: issuer + '/revoke' });
        if (target.endsWith('/revoke')) {
          revokedWith = new URLSearchParams(options.body).get('token');
          await gate;
          return new Response('', { status: 200 });
        }
        throw new Error('unexpected ' + target);
      },
    },
  );
  assert.equal(await manager.token(), 'live-token');
  const logout = manager.logout('a1');
  await new Promise((resolve) => setTimeout(resolve, 10));
  await assert.rejects(manager.token(), /Continue with ChatGPT/);
  assert.equal(saved.activeId, null);
  assert.equal(saved.accounts.a1.access_token, undefined);
  release();
  const result = await logout;
  assert.equal(result.revoked, true);
  assert.equal(revokedWith, 'refresh');
  manager.close();
});

test('an auth failure carries the OAuth reason so an expired sign-in is recognizable', async () => {
  const manager = new ChatGPTAuth(
    async () => ({ hostId: 'urn:uuid:host', activeId: null, accounts: {} }),
    async () => {},
    async () => {},
    {
      fetch: async () =>
        Response.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, { status: 400 }),
    },
  );
  await assert.rejects(
    manager.endpoints.json('https://auth.openai.com/oauth/token'),
    /HTTP 400 \(Refresh token expired\)\. Sign in again/,
  );
});
