const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { PRESETS, forFeature } = require('../src/main/domain/providers/generation-presets.cjs');

const messages = [{ role: 'user', content: 'Fixture question' }];
function fixture() {
  const requests = [];
  const providers = new Providers(
    async () => 'fixture-key',
    async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body), signal: options.signal });
      const events = url.includes('/responses')
        ? [{ type: 'response.output_text.delta', delta: 'Done' }, { type: 'response.completed' }]
        : url.includes('streamGenerateContent')
          ? [{ candidates: [{ content: { parts: [{ text: 'Done' }] } }] }]
          : [{ choices: [{ delta: { content: 'Done' } }] }];
      return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''));
    },
  );
  return { providers, requests };
}

test('every packaged feature preset reaches the compatible HTTP request without leaking configuration fields', async () => {
  const f = fixture();
  for (const feature of Object.keys(PRESETS).filter((item) => item !== 'analysisGemini')) {
    const settings = forFeature({ provider: 'openai', model: 'gpt-4.1' }, feature);
    await f.providers.stream(settings, messages, () => {});
    const body = f.requests.at(-1).body;
    assert.equal(body.max_tokens, PRESETS[feature].maxOutputTokens, feature);
    assert.equal(body.temperature, PRESETS[feature].temperature, feature);
    assert.equal(body.generationFeature, undefined);
    assert.equal(body.generationConfig, undefined);
    assert.equal(body.reasoning_effort, undefined);
  }
});

test('pinned reasoning-model support uses the reasoning output budget and the supported protocol field', async () => {
  const f = fixture();
  await f.providers.stream(forFeature({ provider: 'openai', model: 'gpt-5.6-terra' }, 'analysis'), messages, () => {});
  assert.equal(f.requests[0].body.max_completion_tokens, 3000);
  assert.equal(f.requests[0].body.reasoning_effort, 'medium');
  assert.equal(f.requests[0].body.temperature, undefined);
  await f.providers.stream(forFeature({ provider: 'openai', model: 'gpt-5.4-mini' }, 'followUp'), messages, () => {});
  assert.equal(f.requests[1].body.max_completion_tokens, 300);
  assert.equal(f.requests[1].body.reasoning_effort, undefined);
  assert.equal(f.requests[1].body.temperature, undefined);
  await f.providers.stream(forFeature({ provider: 'chatgpt', model: 'gpt-5.6-terra' }, 'tldr'), messages, () => {});
  assert.equal(f.requests[2].body.max_output_tokens, 4096);
  assert.deepEqual(f.requests[2].body.reasoning, { effort: 'medium' });
  assert.equal(f.requests[2].body.max_completion_tokens, undefined);
});

test('GPT-6 and o-series models never receive temperature, on either protocol', async () => {
  const f = fixture();
  await f.providers.stream(forFeature({ provider: 'chatgpt', model: 'gpt-6.1-sol' }, 'analysis'), messages, () => {});
  assert.equal(f.requests[0].body.temperature, undefined);
  assert.equal(f.requests[0].body.max_output_tokens, 1500);
  await f.providers.stream(forFeature({ provider: 'openai', model: 'gpt-6.1-sol' }, 'followUp'), messages, () => {});
  assert.equal(f.requests[1].body.temperature, undefined);
  assert.equal(f.requests[1].body.max_completion_tokens, 300);
  await f.providers.stream(forFeature({ provider: 'openai', model: 'o4-mini' }, 'translation'), messages, () => {});
  assert.equal(f.requests[2].body.temperature, undefined);
  assert.equal(f.requests[2].body.max_completion_tokens, 512);
});

test('Gemini analysis and translation use their feature budgets and model-specific thinking configuration', async () => {
  const f = fixture();
  await f.providers.stream(forFeature({ provider: 'gemini', model: 'gemini-2.5-pro' }, 'analysis'), messages, () => {});
  assert.deepEqual(f.requests[0].body.generationConfig, {
    temperature: 0.4,
    maxOutputTokens: 3000,
    thinkingConfig: { thinkingBudget: 128 },
  });
  await f.providers.stream(
    forFeature({ provider: 'gemini', model: 'gemini-3.1-flash' }, 'translation'),
    messages,
    () => {},
  );
  assert.deepEqual(f.requests[1].body.generationConfig, {
    temperature: 0,
    maxOutputTokens: 512,
    thinkingConfig: { thinkingLevel: 'minimal' },
  });
});

test('a bounded internal request override survives routing and does not change later requests', async () => {
  const f = fixture();
  const original = { provider: 'openai', model: 'gpt-4.1' };
  await f.providers.stream(forFeature(original, 'realtimeSummary', { maxOutputTokens: 420 }), messages, () => {});
  await f.providers.stream(forFeature(original, 'realtimeSummary'), messages, () => {});
  assert.equal(f.requests[0].body.max_tokens, 420);
  assert.equal(f.requests[1].body.max_tokens, 2048);
  assert.equal(original.generationConfig, undefined);
});

test('cancelled feature generation never sends a request and local voice keeps its output bound', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    f.providers.stream(
      forFeature({ provider: 'openai', model: 'gpt-4.1' }, 'analysis'),
      messages,
      () => {},
      controller.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(f.requests.length, 0);
  await f.providers.stream(
    { provider: 'custom', customBaseUrl: 'http://127.0.0.1:1/v1', model: 'fixture-local', localVoice: true },
    messages,
    () => {},
  );
  assert.equal(f.requests[0].body.max_tokens, 384);
  assert.deepEqual(f.requests[0].body.chat_template_kwargs, { enable_thinking: false });
});
