const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { sse } = require('../src/main/infrastructure/providers/sse.cjs');
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');
function response(parts) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    }),
  );
}
test('SSE handles split frames, CRLF, comments, Unicode and end marker', async () => {
  const events = [];
  for await (const event of sse(
    response([': comment\r\n\r\ndata: {"text":', '"olá"}\r\n\r\ndata: {"count":2}\n\ndata: [DONE]\n\n']),
  ))
    events.push(event);
  assert.deepEqual(events, [{ text: 'olá' }, { count: 2 }]);
});
test('streamed compatible-provider output and images follow the configured route', async () => {
  let request;
  const providers = new Providers(
    async () => '',
    async (url, options) => {
      request = { url, options };
      return response([
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n',
      ]);
    },
  );
  const deltas = [];
  const text = await providers.stream(
    { ...DEFAULTS, provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', model: 'local-test' },
    [{ role: 'user', content: 'Describe' }],
    (delta) => deltas.push(delta),
    undefined,
    'data:image/png;base64,dGVzdA==',
  );
  assert.equal(text, 'Hello world');
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.equal(request.url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, undefined);
  const body = JSON.parse(request.options.body);
  assert.deepEqual(
    body.messages[0].content.map((part) => part.type),
    ['image_url', 'text'],
  );
  assert.equal(request.options.redirect, 'error');
});
test('all provider transports preserve screenshot order and managed text models reject images', async () => {
  const images = ['data:image/png;base64,YQ==', 'data:image/jpeg;base64,Yg=='];
  for (const provider of ['custom', 'chatgpt', 'gemini']) {
    let payload;
    const p = new Providers(
      async () => 'fixture-key',
      async (_url, options) => {
        payload = JSON.parse(options.body);
        if (provider === 'chatgpt')
          return response([
            'data: {"type":"response.output_text.delta","delta":"Seen"}\n\n',
            'data: {"type":"response.completed"}\n\n',
          ]);
        if (provider === 'gemini')
          return response(['data: {"candidates":[{"content":{"parts":[{"text":"Seen"}]}}]}\n\n']);
        return response(['data: {"choices":[{"delta":{"content":"Seen"}}]}\n\ndata: [DONE]\n\n']);
      },
    );
    assert.equal(
      await p.stream(
        { ...DEFAULTS, provider, customBaseUrl: 'http://localhost:11434/v1', model: 'fixture' },
        [{ role: 'user', content: 'Compare' }],
        () => {},
        undefined,
        images,
      ),
      'Seen',
    );
    const actual =
      provider === 'chatgpt'
        ? payload.input[0].content.slice(1).map((part) => part.image_url)
        : provider === 'gemini'
          ? payload.contents[0].parts
              .slice(1)
              .map((part) => `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
          : payload.messages[0].content.filter((part) => part.type === 'image_url').map((part) => part.image_url.url);
    if (provider === 'custom')
      assert.deepEqual(
        payload.messages[0].content.map((part) => part.text || 'image'),
        ['Image 1:', 'image', 'Image 2:', 'image', 'Compare'],
      );
    assert.deepEqual(actual, images);
  }
  const p = new Providers(
    async () => '',
    async () => {
      throw new Error('Transport should not run.');
    },
  );
  await assert.rejects(
    p.stream(
      {
        ...DEFAULTS,
        provider: 'custom',
        customBaseUrl: 'http://localhost:11434/v1',
        model: 'fixture',
        managedLocal: true,
        visionCapable: false,
      },
      [{ role: 'user', content: 'Compare' }],
      () => {},
      undefined,
      images,
    ),
    /vision model and projector/,
  );
});
test('Gemini maps system instructions and streamed text without putting the key into the URL', async () => {
  let request;
  const p = new Providers(
    async () => 'fixture-key',
    async (url, options) => {
      request = { url, options };
      return response(['data: {"candidates":[{"content":{"parts":[{"text":"Answer"}]}}]}\n\n']);
    },
  );
  const answer = await p.stream(
    { ...DEFAULTS, provider: 'gemini', model: 'fixture' },
    [
      { role: 'system', content: 'Instructions' },
      { role: 'user', content: 'Question' },
    ],
    () => {},
  );
  assert.equal(answer, 'Answer');
  assert.ok(!request.url.includes('fixture-key'));
  assert.equal(request.options.headers['x-goog-api-key'], 'fixture-key');
  assert.equal(JSON.parse(request.options.body).systemInstruction.parts[0].text, 'Instructions');
});
test('HTTP failures do not leak provider response bodies or credentials', async () => {
  const p = new Providers(
    async () => 'fixture-key',
    async () => new Response('sensitive provider diagnostics', { status: 401 }),
  );
  await assert.rejects(
    p.stream({ ...DEFAULTS, model: 'fixture' }, [{ role: 'user', content: 'Question' }], () => {}),
    (error) =>
      error.message.startsWith('OpenAI rejected the credentials (HTTP 401)') && !error.message.includes('sensitive'),
  );
});
test('local transcription uses multipart audio and configured model', async () => {
  let request;
  const p = new Providers(
    async () => '',
    async (url, options) => {
      request = { url, options };
      return Response.json({ text: 'Real endpoint result' });
    },
  );
  const result = await p.transcribe(
    {
      ...DEFAULTS,
      transcriptionProvider: 'custom',
      transcriptionBaseUrl: 'http://localhost:8080/v1',
      transcriptionModel: 'whisper-local',
    },
    new Uint8Array([1, 2, 3]),
    'audio/webm',
  );
  assert.equal(result, 'Real endpoint result');
  assert.equal(request.url, 'http://localhost:8080/v1/audio/transcriptions');
  assert.equal(request.options.body.get('model'), 'whisper-local');
  assert.equal(request.options.body.get('file').size, 3);
});
test('a caller abort signal reaches the underlying request', async () => {
  const controller = new AbortController();
  const p = new Providers(
    async () => '',
    async (_url, options) => {
      assert.equal(options.signal, controller.signal);
      throw new DOMException('Cancelled', 'AbortError');
    },
  );
  await assert.rejects(
    p.stream(
      { ...DEFAULTS, provider: 'custom', customBaseUrl: 'http://localhost:11434/v1', model: 'fixture' },
      [{ role: 'user', content: 'Question' }],
      () => {},
      controller.signal,
    ),
    { name: 'AbortError' },
  );
});

test('an unconfigured custom provider rejects chat and model listing before transport', async () => {
  let requests = 0;
  const p = new Providers(
    async () => '',
    async () => {
      requests++;
      throw new Error('No transport expected.');
    },
  );
  const settings = { ...DEFAULTS, provider: 'custom', model: 'fixture' };
  assert.equal(settings.customBaseUrl, '');
  await assert.rejects(
    p.stream(settings, [{ role: 'user', content: 'Question' }], () => {}),
    /Enter a valid provider endpoint/,
  );
  await assert.rejects(p.models(settings), /Enter a valid provider endpoint/);
  assert.equal(requests, 0);
});

test('readiness reports a missing model or key without any request', async () => {
  const p = new Providers(
    async (provider) => (provider === 'openai' ? 'key' : ''),
    async () => {
      throw new Error('No request expected.');
    },
  );
  await assert.rejects(p.ready({ provider: 'chatgpt', model: '' }), /assistant model/);
  await assert.rejects(p.ready({ provider: 'gemini', model: 'g' }), /provider key/);
  await p.ready({ provider: 'openai', model: 'gpt' });
  await p.ready({ provider: 'custom', model: 'm' });
  await p.ready({ provider: 'custom', managedLocal: true, model: 'local' });
});

test('managed local model listing sends the leased key, never a saved credential', async () => {
  let request;
  const key = 'b'.repeat(64);
  const p = new Providers(
    () => {
      throw new Error('Saved credential was accessed');
    },
    async (url, options) => {
      request = { url, options };
      return Response.json({ data: [{ id: 'local-model' }] });
    },
  );
  const models = await p.models({
    ...DEFAULTS,
    provider: 'custom',
    managedLocal: true,
    customBaseUrl: 'http://127.0.0.1:12345/v1',
    localApiKey: key,
  });
  assert.deepEqual(models, ['local-model']);
  assert.equal(request.url, 'http://127.0.0.1:12345/v1/models');
  assert.equal(request.options.headers.Authorization, `Bearer ${key}`);
});
