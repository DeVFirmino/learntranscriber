const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DYNAMIC_CLIENT,
  issuedClient,
  authorizationParams,
  planScopes,
  accountKey,
} = require('../src/main/domain/integrations/chatgpt-identity.cjs');

const flow = { state: 's', nonce: 'n', verifier: 'v' };

test('the issued client is the returned one, or the saved one, never the dynamic placeholder', () => {
  assert.equal(issuedClient('app_1', DYNAMIC_CLIENT), 'app_1');
  assert.equal(issuedClient(null, 'app_1'), 'app_1');
  assert.equal(issuedClient('app_2', 'app_1'), null);
  assert.equal(issuedClient(null, DYNAMIC_CLIENT), null);
  assert.equal(issuedClient('bad id!', DYNAMIC_CLIENT), null);
});

test('the authorization request asks for a dynamic client only on first sign-in', () => {
  const first = authorizationParams({ clientId: DYNAMIC_CLIENT, hostId: 'h', redirect: 'r', resource: 'api', flow });
  assert.equal(first.agent_name_hint, 'LearnTranscriber');
  assert.equal(first.code_challenge_method, 'S256');
  assert.notEqual(first.code_challenge, 'v');
  const again = authorizationParams({
    clientId: 'app_1',
    hostId: 'h',
    redirect: 'r',
    resource: 'api',
    flow,
    idTokenHint: 't',
  });
  assert.equal(again.agent_name_hint, undefined);
  assert.equal(again.id_token_hint, 't');
});

test('plan scopes must include direct token use and resource access with a bearer token', () => {
  const tokens = { scope: 'openid resource.invoke chatgpt.tokens.use.direct', access_token: 'a', token_type: 'Bearer' };
  assert.deepEqual(planScopes(tokens), ['openid', 'resource.invoke', 'chatgpt.tokens.use.direct']);
  assert.throws(() => planScopes({ ...tokens, scope: 'openid resource.invoke' }), /not granted/);
  assert.throws(() => planScopes({ ...tokens, token_type: 'mac' }), /not granted/);
  assert.equal(accountKey('app_1', 'subject').length, 24);
  assert.equal(accountKey('app_1', 'subject'), accountKey('app_1', 'subject'));
});
