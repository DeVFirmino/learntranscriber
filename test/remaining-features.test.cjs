const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { SystemAudio } = require('../src/main/infrastructure/native/system-audio.cjs');
const { wav } = require('../src/main/domain/audio/wav.cjs');
const { RuntimeInstaller } = require('../src/main/infrastructure/local/runtime-installer.cjs');
const { ChatGPTAuth } = require('../src/main/infrastructure/integrations/chatgpt-auth.cjs');
const { validateIdentity } = require('../src/main/domain/integrations/chatgpt-identity.cjs');
const stream = (events) =>
  new Response(events.map((e) => 'data: ' + JSON.stringify(e) + '\n\n').join('') + 'data: [DONE]\n\n');
test('model tool calls assemble split arguments and feed results back while preserving the image', async () => {
  let pass = 0,
    executed = false;
  const controller = new AbortController();
  const providers = new Providers(
    async () => '',
    async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(
        body.messages.find((m) => m.role === 'user').content.find((part) => part.type === 'image_url').image_url.url,
        'data:image/png;base64,AAAA',
      );
      if (pass++ === 0)
        return stream([
          {
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, id: 'call_1', function: { name: 'lookup', arguments: '{"topic":' } }],
                },
              },
            ],
          },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"queue"}' } }] } }] },
        ]);
      assert.equal(body.messages.at(-1).role, 'tool');
      assert.match(body.messages.at(-1).content, /approved result/);
      return stream([{ choices: [{ delta: { content: 'Answer from the tool' } }] }]);
    },
  );
  const answer = await providers.stream(
    { provider: 'custom', model: 'fixture', customBaseUrl: 'http://127.0.0.1:1234/v1' },
    [{ role: 'user', content: 'Question' }],
    () => {},
    controller.signal,
    'data:image/png;base64,AAAA',
    {
      tools: [{ name: 'lookup', parameters: { type: 'object' } }],
      handleTool: async (call) => {
        executed = call.name === 'lookup';
        return 'approved result';
      },
    },
  );
  assert.equal(answer, 'Answer from the tool');
  assert.equal(executed, true);
  assert.equal(pass, 2);
});
test('unoffered tools never execute', async () => {
  const provider = new Providers(
    async () => '',
    async () =>
      stream([
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, id: 'bad', function: { name: 'not_offered', arguments: '{}' } }] } },
          ],
        },
      ]),
  );
  let calls = 0;
  await assert.rejects(
    provider.stream(
      { provider: 'custom', model: 'fixture', customBaseUrl: 'http://127.0.0.1:1234/v1' },
      [{ role: 'user', content: 'Hi' }],
      () => {},
      new AbortController().signal,
      undefined,
      {
        tools: [],
        handleTool: () => {
          calls++;
        },
      },
    ),
    /not offered/,
  );
  assert.equal(calls, 0);
});
test('Gemini tool responses preserve thought signatures and function response identity', async () => {
  let pass = 0;
  const provider = new Providers(
    async () => 'fixture',
    async (_url, options) => {
      const body = JSON.parse(options.body);
      if (pass++ === 0)
        return stream([
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: { name: 'lookup', id: 'gemini-call', args: { q: 'queue' } },
                      thoughtSignature: 'fixture-signature',
                    },
                  ],
                },
              },
            ],
          },
        ]);
      assert.equal(body.contents[1].parts[0].thoughtSignature, 'fixture-signature');
      assert.equal(body.contents[2].parts[0].functionResponse.id, 'gemini-call');
      return stream([{ candidates: [{ content: { parts: [{ text: 'Gemini tool answer' }] } }] }]);
    },
  );
  assert.equal(
    await provider.stream(
      { provider: 'gemini', model: 'fixture' },
      [{ role: 'user', content: 'Hi' }],
      () => {},
      new AbortController().signal,
      undefined,
      { tools: [{ name: 'lookup', parameters: { type: 'object' } }], handleTool: async () => ({ text: 'result' }) },
    ),
    'Gemini tool answer',
  );
});
test('ChatGPT responses require a completed event even after text has streamed', async () => {
  const settings = { provider: 'chatgpt', model: 'fixture' };
  const provider = new Providers(
    async () => 'fixture-token',
    async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      return stream([{ type: 'response.output_text.delta', delta: 'Partial' }]);
    },
  );
  await assert.rejects(
    provider.stream(settings, [{ role: 'user', content: 'Hi' }], () => {}, new AbortController().signal),
    /before response.completed/,
  );
  provider.fetch = async () =>
    stream([
      { type: 'response.output_text.delta', delta: 'Complete' },
      { type: 'response.completed', response: { status: 'completed' } },
    ]);
  assert.equal(
    await provider.stream(settings, [{ role: 'user', content: 'Hi' }], () => {}, new AbortController().signal),
    'Complete',
  );
});
test('native audio packet framing handles split data and flushes final PCM before process shutdown', async () => {
  let child;
  const chunks = [];
  const manager = new SystemAudio(
    '/fixture',
    (packet) => chunks.push(packet),
    () => {},
    {
      spawn: () => {
        child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stdin = new PassThrough();
        child.kill = () => child.emit('exit', 0);
        child.stdin.on('data', () => {
          child.stdout.write(
            JSON.stringify({ event: 'audio', samples: Buffer.from([1, 0, 2, 0]).toString('base64') }) + '\n',
          );
          child.emit('exit', 0);
        });
        return child;
      },
    },
  );
  const starting = manager.start('session');
  child.stdout.write('{"event":"sta');
  child.stdout.write('rted"}\n');
  await starting;
  await manager.stop();
  const data = Buffer.from(chunks[0].bytes);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.readUInt32LE(24), 16000);
  assert.deepEqual(data.subarray(44), Buffer.from([1, 0, 2, 0]));
  assert.equal(manager.child, null);
  assert.throws(() => wav(Buffer.from([1])), /Invalid/);
});
test('runtime installer uses a fixed formula, no shell, no auto-update and registers the resolved executable', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-install-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const brew = path.join(directory, 'brew'),
    binary = path.join(directory, 'bin/whisper-server');
  await fs.mkdir(path.dirname(binary));
  await fs.writeFile(brew, 'fixture', { mode: 0o700 });
  await fs.writeFile(binary, 'fixture', { mode: 0o700 });
  let chosen;
  const manager = new RuntimeInstaller(
    {
      state: () => ({ runtimes: { whisper: { status: 'stopped' } } }),
      setBinary: async (kind, file) => {
        chosen = { kind, file };
      },
    },
    () => {},
    {
      paths: [brew],
      execute: async () => ({ stdout: directory }),
      spawn: (file, args, options) => {
        assert.equal(file, brew);
        assert.deepEqual(args, ['install', 'whisper-cpp']);
        assert.equal(options.shell, false);
        assert.equal(options.env.HOMEBREW_NO_AUTO_UPDATE, '1');
        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        setImmediate(() => child.emit('exit', 0));
        return child;
      },
    },
  );
  await manager.install('whisper');
  assert.deepEqual(chosen, { kind: 'whisper', file: binary });
  assert.equal(manager.state().length, 0);
  await assert.rejects(manager.install('unknown'), /Choose/);
});
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
function jwt(claims) {
  const data =
    Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify(claims)).toString('base64url');
  return data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
}
test('ChatGPT identity rejects wrong nonce, audience, expired claims and tampered signatures', () => {
  const now = Date.UTC(2026, 9, 31, 12);
  const claims = {
    iss: 'https://auth.openai.com',
    aud: 'issued-client',
    exp: now / 1000 + 300,
    sub: 'subject',
    nonce: 'nonce',
  };
  const token = jwt(claims);
  const check = (value, overrides = {}) =>
    validateIdentity(
      value,
      { keys: [jwk] },
      { issuer: claims.iss, clientId: claims.aud, nonce: 'nonce', now, ...overrides },
    );
  assert.equal(check(token).subject, 'subject');
  assert.throws(() => check(token, { nonce: 'wrong' }), /validation/);
  assert.throws(() => check(token, { clientId: 'wrong' }), /validation/);
  assert.throws(() => check(jwt({ ...claims, exp: 1 })), /validation/);
  assert.throws(() => check(token, { now: now + 301000 }), /validation/, 'expired by the injected clock');
  assert.throws(() => check(token.replace('ey', 'xx')));
});
test('ChatGPT dynamic registration exchanges the issued client ID, separates account records and serializes token rotation', async () => {
  let saved,
    authorization,
    refreshes = 0;
  const issuer = 'https://auth.openai.com';
  const manager = new ChatGPTAuth(
    async () => (saved ? structuredClone(saved) : null),
    async (data) => {
      saved = structuredClone(data);
    },
    async (value) => {
      authorization = new URL(value);
      assert.equal(authorization.searchParams.get('client_id'), 'dynamic_agent_client');
      const callback = new URL(authorization.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      callback.searchParams.set('code', 'fixture');
      callback.searchParams.set('client_id', 'oaiapp_fixture');
      assert.equal((await fetch(callback)).status, 200);
    },
    {
      fetch: async (url, options) => {
        const target = String(url);
        if (target.endsWith('/.well-known/openid-configuration'))
          return Response.json({ issuer, jwks_uri: issuer + '/jwks', revocation_endpoint: issuer + '/revoke' });
        if (target.endsWith('/jwks')) return Response.json({ keys: [jwk] });
        if (target.endsWith('/revoke')) return new Response('', { status: 200 });
        const fields = new URLSearchParams(options.body);
        assert.equal(fields.get('client_id'), 'oaiapp_fixture');
        if (fields.get('grant_type') === 'refresh_token') {
          refreshes++;
          await new Promise(setImmediate);
          return Response.json({
            access_token: 'fixture-renewed',
            refresh_token: 'fixture-rotated',
            token_type: 'Bearer',
            expires_in: 3600,
          });
        }
        assert.equal(
          createHash('sha256').update(fields.get('code_verifier')).digest('base64url'),
          authorization.searchParams.get('code_challenge'),
        );
        return Response.json({
          access_token: 'fixture-access',
          refresh_token: 'fixture-refresh',
          token_type: 'Bearer',
          expires_in: 1,
          scope: 'openid resource.invoke chatgpt.tokens.use.direct',
          id_token: jwt({
            iss: issuer,
            aud: 'oaiapp_fixture',
            exp: Date.now() / 1000 + 300,
            sub: 'subject',
            email: 'fixture@example.invalid',
            nonce: authorization.searchParams.get('nonce'),
          }),
        });
      },
    },
  );
  const status = await manager.login();
  assert.equal(status.accounts.length, 1);
  assert.equal(JSON.stringify(status).includes('fixture-access'), false);
  const host = saved.hostId;
  const tokens = await Promise.all([manager.token(), manager.token()]);
  assert.deepEqual(tokens, ['fixture-renewed', 'fixture-renewed']);
  assert.equal(refreshes, 1);
  assert.equal(saved.hostId, host);
  assert.equal(saved.accounts[saved.activeId].refresh_token, 'fixture-rotated');
  const id = saved.activeId;
  const result = await manager.logout(id);
  assert.equal(result.revoked, true);
  assert.equal(saved.accounts[id].client_id, 'oaiapp_fixture');
  assert.equal(saved.accounts[id].access_token, undefined);
  manager.close();
});
