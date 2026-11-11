const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');

function streamOf(events) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(new Blob([text]).stream(), { status: 200 });
}
function capture(events, headers = []) {
  const requests = [];
  return {
    requests,
    providers: new Providers(
      async () => 'key-1',
      async (url, options) => {
        requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
        return streamOf(events);
      },
      async () => headers,
    ),
  };
}
const messages = [
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Hi' },
];

test('compatible providers post chat completions with the bearer and custom headers only for custom endpoints', async () => {
  const { requests, providers } = capture(
    [{ choices: [{ delta: { content: 'Hello' } }] }],
    [{ key: 'X-Team', value: 'blue' }],
  );
  assert.equal(
    await providers.stream(
      { provider: 'custom', customBaseUrl: 'https://llm.example.com/v1', model: 'm' },
      messages,
      () => {},
    ),
    'Hello',
  );
  assert.equal(requests[0].url, 'https://llm.example.com/v1/chat/completions');
  assert.equal(requests[0].headers.Authorization, 'Bearer key-1');
  assert.equal(requests[0].headers['X-Team'], 'blue');
  await providers.stream({ provider: 'openrouter', model: 'm' }, messages, () => {});
  assert.equal(requests[1].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(requests[1].headers['X-Team'], undefined);
});

test('ChatGPT posts a Responses request and requires a completed stream', async () => {
  const done = capture([{ type: 'response.output_text.delta', delta: 'Hey' }, { type: 'response.completed' }]);
  assert.equal(await done.providers.stream({ provider: 'chatgpt', model: 'gpt' }, messages, () => {}), 'Hey');
  assert.equal(done.requests[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(done.requests[0].body.instructions, 'Be brief.');
  assert.equal(done.requests[0].body.store, false);
  const cut = capture([{ type: 'response.output_text.delta', delta: 'Hey' }]);
  await assert.rejects(
    cut.providers.stream({ provider: 'chatgpt', model: 'gpt' }, messages, () => {}),
    /ended before response.completed/,
  );
});

test('Gemini streams generateContent, hides thoughts and replays tool parts with their results', async () => {
  let round = 0;
  const requests = [];
  const providers = new Providers(
    async () => 'g-key',
    async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      round++;
      return streamOf(
        round === 1
          ? [
              {
                candidates: [
                  {
                    content: {
                      parts: [
                        { thought: true, text: 'hmm' },
                        { functionCall: { name: 'lookup', args: { q: 'x' } }, thoughtSignature: 'sig' },
                      ],
                    },
                  },
                ],
              },
            ]
          : [{ candidates: [{ content: { parts: [{ text: 'Found.' }] } }] }],
      );
    },
  );
  const tools = [{ name: 'lookup', description: 'Look up', parameters: { type: 'object' } }];
  const answer = await providers.stream(
    { provider: 'gemini', model: 'gemini-pro' },
    messages,
    () => {},
    undefined,
    undefined,
    { tools, handleTool: async () => ({ text: 'x=1' }) },
  );
  assert.equal(answer, 'Found.');
  assert.equal(requests[1].body.generationConfig.maxOutputTokens, 500);
  assert.match(requests[0].url, /models\/gemini-pro:streamGenerateContent\?alt=sse$/);
  const replay = requests[1].body.contents;
  assert.equal(replay.at(-2).parts[1].thoughtSignature, 'sig');
  assert.deepEqual(replay.at(-1).parts[0].functionResponse, { name: 'lookup', response: { output: { text: 'x=1' } } });
});
