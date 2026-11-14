const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const {
  createRealtimePrompts,
  prepareOnSessionStart,
} = require('../src/main/application/assistants/realtime-prompts.cjs');
const { prepareSessionContext } = require('../src/main/application/sessions/context-preparation.cjs');
const { PRESETS, forFeature } = require('../src/main/domain/providers/generation-presets.cjs');
const {
  META_SYSTEM,
  fallbackInstruction,
  languageInstruction,
} = require('../src/main/domain/assistants/realtime-prompt.cjs');

const SETTINGS = forFeature({ provider: 'openai', model: 'gpt-4.1', uiLanguage: 'pt-BR' }, 'realtimeSummary');
const ASSISTANT = { id: 'a1', prompt: 'Coach sales calls.', realtime_prompt: '' };

function fixture({ answer = 'Write the exact words ME should say next to advance the sale.', fail } = {}) {
  const calls = [];
  let clock = 0;
  const prompts = createRealtimePrompts({
    now: () => clock,
    providers: {
      stream: async (settings, messages, _onDelta, signal) => {
        calls.push({ settings, messages });
        signal?.throwIfAborted();
        if (fail) throw new Error('Provider down');
        return answer;
      },
    },
  });
  return { prompts, calls, advance: (ms) => (clock += ms) };
}

test('an assistant realtime prompt wins and makes no meta request', async () => {
  const f = fixture();
  const result = await f.prompts.guidance({
    assistant: { ...ASSISTANT, realtime_prompt: 'Own live guidance' },
    settings: SETTINGS,
  });
  assert.deepEqual(result, { prompt: 'Own live guidance', source: 'assistant' });
  assert.equal(f.calls.length, 0);
});

test('an empty realtime prompt is generated once on the meta preset with the selected model', async () => {
  const f = fixture();
  const first = await f.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS });
  assert.deepEqual(first, {
    prompt: 'Write the exact words ME should say next to advance the sale.',
    source: 'generated',
  });
  assert.equal(f.calls.length, 1);
  const [{ settings, messages }] = f.calls;
  assert.equal(settings.generationFeature, 'realtimeSummaryMeta');
  assert.deepEqual(settings.generationConfig, PRESETS.realtimeSummaryMeta);
  assert.equal(settings.model, 'gpt-4.1');
  assert.deepEqual(messages, [
    { role: 'system', content: META_SYSTEM },
    {
      role: 'user',
      content: `Assistant's role and purpose: "Coach sales calls."\n\nLanguage instruction: ${languageInstruction(SETTINGS)}\n\nGenerate the instruction now.`,
    },
  ]);
  // Cached per assistant, system prompt, language and model.
  assert.deepEqual(await f.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS }), first);
  assert.equal(f.calls.length, 1);
  await f.prompts.guidance({ assistant: ASSISTANT, settings: { ...SETTINGS, uiLanguage: 'es' } });
  await f.prompts.guidance({ assistant: ASSISTANT, settings: { ...SETTINGS, model: 'gpt-4o' } });
  await f.prompts.guidance({ assistant: { ...ASSISTANT, prompt: 'Coach interviews.' }, settings: SETTINGS });
  assert.equal(f.calls.length, 4);
});

test('a local model skips the meta request and uses the language fallback', async () => {
  const f = fixture();
  for (const settings of [
    { ...SETTINGS, provider: 'local' },
    { ...SETTINGS, provider: 'custom', managedLocal: true },
  ])
    assert.deepEqual(await f.prompts.guidance({ assistant: ASSISTANT, settings }), {
      prompt: fallbackInstruction(),
      source: 'local default',
    });
  assert.equal(f.calls.length, 0);
});

test('a failed or empty meta answer uses the fallback, which is retried after ten minutes', async () => {
  const failing = fixture({ fail: true });
  const result = await failing.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS });
  assert.deepEqual(result, { prompt: fallbackInstruction(), source: 'fallback' });
  await failing.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS });
  assert.equal(failing.calls.length, 1);
  failing.advance(10 * 60 * 1000 + 1);
  await failing.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS });
  assert.equal(failing.calls.length, 2);

  const empty = fixture({ answer: '   ' });
  assert.equal((await empty.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS })).source, 'fallback');
});

test('a cancelled meta request keeps nothing, so the next insight asks again', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS, signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal((await f.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS })).source, 'generated');
  assert.equal(f.calls.length, 2);
});

test('the language instruction is the output-language requirement in the interface language', () => {
  assert.match(
    languageInstruction({ uiLanguage: 'pt-BR' }),
    /^IMPORTANT: The required output language is Portuguese \(Brazilian\)\. Write the entire teleprompter output in Portuguese \(Brazilian\),/,
  );
  assert.match(languageInstruction({ uiLanguage: 'es' }), /required output language is Spanish\./);
  assert.match(languageInstruction({ uiLanguage: 'en' }), /required output language is English\./);
});

test('the generated instruction guides automatic insights only', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const assistantId = repos.assistants.save({ name: 'Sales', prompt: 'Coach sales calls.' });
  const session = repos.sessions.create('Call', assistantId);
  repos.entries.add(session.id, 'transcript', 'What does the premium plan include?', 'THEY');
  const f = fixture();
  const prepare = (mode) =>
    prepareSessionContext({
      repositories: repos,
      providers: { checkContext: async () => {} },
      id: session.id,
      mode,
      question: 'Question',
      settings: { ...SETTINGS, insightMode: 'proactive', compactThreshold: 50000, autoCompact: false },
      signal: new AbortController().signal,
      realtimePrompts: f.prompts,
    });
  const [system, user] = await prepare('insight');
  // The generated instruction in the output language under the assistant's task, then the Notch mode section; the
  // session's first request goes without the autonomous suffix.
  assert.match(
    system.content,
    /^Write the exact words ME should say next to advance the sale\.\n\nFINAL LANGUAGE REQUIREMENT:\n/,
  );
  assert.match(system.content, /<assistant_task>\nCoach sales calls\.\n<\/assistant_task>/);
  assert.match(system.content, /## Notch mode: Proactive/);
  assert.doesNotMatch(system.content, /<autonomous_mode>/);
  assert.match(
    user.content,
    /Current round transcript messages since the last Notch analysis attempt:\n\nTHEY: What does the premium plan include\?$/,
  );
  assert.equal(f.calls.length, 1);
  for (const mode of ['chat', 'summary', 'email', 'screenInsight'])
    assert.doesNotMatch((await prepare(mode))[0].content, /advance the sale|## Notch mode/, mode);
  assert.equal(f.calls.length, 1);
});

test('the session-start request is shared with an insight that arrives while it runs', async () => {
  let finish;
  const calls = [];
  const prompts = createRealtimePrompts({
    now: Date.now,
    providers: {
      stream: (settings, messages) => {
        calls.push(messages);
        return new Promise((resolve) => (finish = resolve));
      },
    },
  });
  const preparing = prompts.prepare({ assistant: ASSISTANT, settings: SETTINGS });
  prompts.prepare({ assistant: ASSISTANT, settings: SETTINGS });
  const insight = prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS });
  const cancelled = new AbortController();
  const abandoned = prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS, signal: cancelled.signal });
  cancelled.abort();
  await assert.rejects(abandoned, { name: 'AbortError' });
  finish('Say the next sales step.');
  assert.equal(await preparing, undefined);
  assert.deepEqual(await insight, { prompt: 'Say the next sales step.', source: 'generated' });
  assert.equal(calls.length, 1);
  assert.equal((await prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS })).source, 'generated');
  assert.equal(calls.length, 1);
});

test('a failed session-start request never throws and leaves the fallback for the first insight', async () => {
  const f = fixture({ fail: true });
  assert.equal(await f.prompts.prepare({ assistant: ASSISTANT, settings: SETTINGS }), undefined);
  assert.equal((await f.prompts.guidance({ assistant: ASSISTANT, settings: SETTINGS })).source, 'fallback');
  assert.equal(f.calls.length, 1);
});

test('a started session prepares the instruction with the insight settings, only when automatic insights are on', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ provider: 'openai', model: 'gpt-4.1', language: 'pt', autoInsights: true });
  const session = repos.sessions.create('Call', 'general');
  const f = fixture();
  const started = prepareOnSessionStart({
    settings: repos.settings,
    sessions: repos.sessions,
    assistants: repos.assistants,
    realtimePrompts: f.prompts,
  });
  await started(session.id);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].settings.generationFeature, 'realtimeSummaryMeta');
  assert.equal(f.calls[0].settings.model, 'gpt-4.1');
  // The first insight finds the instruction ready.
  const { generationSettings } = require('../src/main/domain/sessions/generation.cjs');
  const insight = generationSettings('insight', repos.settings.read(), repos.sessions.get(session.id));
  await f.prompts.guidance({ assistant: repos.assistants.forSession(session.assistant_id), settings: insight });
  assert.equal(f.calls.length, 1);

  const off = fixture();
  repos.settings.update({ autoInsights: false });
  await prepareOnSessionStart({
    settings: repos.settings,
    sessions: repos.sessions,
    assistants: repos.assistants,
    realtimePrompts: off.prompts,
  })(session.id);
  assert.equal(off.calls.length, 0);
});
