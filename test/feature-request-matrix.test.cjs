// FP05-S02 fixture: every feature path, driven through its real workflow, reaches the serialized provider request
// with the pinned preset for each provider family; cancelling an in-flight request saves no partial answer.
// Requests go to an in-process fetch stub; no network or provider is contacted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { Providers } = require('../src/main/infrastructure/providers/index.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createGeneration } = require('../src/main/application/sessions/generate.cjs');
const { createRealtimePrompts } = require('../src/main/application/assistants/realtime-prompts.cjs');
const { createCompactor } = require('../src/main/application/compaction/compact.cjs');
const { persistGeneratedOutput } = require('../src/main/application/sessions/generated-output.cjs');
const { prepareSessionContext } = require('../src/main/application/sessions/context-preparation.cjs');
const { summaryRewriteMessages, cleanSummaryRewrite } = require('../src/main/domain/sessions/summary-rewrite.cjs');
const { createFollowUpGenerator } = require('../src/main/application/sessions/follow-up-generator.cjs');
const { createEntryTranslation } = require('../src/main/application/sessions/entry-translation.cjs');
const { PRESETS } = require('../src/main/domain/providers/generation-presets.cjs');

const FAMILIES = {
  'openai reasoning': { provider: 'openai', model: 'gpt-5.6-terra' },
  openai: { provider: 'openai', model: 'gpt-4.1' },
  'chatgpt responses': { provider: 'chatgpt', model: 'gpt-5.6-terra' },
  gemini: { provider: 'gemini', model: 'gemini-2.5-pro' },
  openrouter: { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct' },
  custom: { provider: 'custom', customBaseUrl: 'http://127.0.0.1:9/v1', model: 'fixture' },
};
// The pinned table: path → preset (Gemini analysis uses its own preset).
const PATHS = {
  answer: 'analysis',
  'screen insight': 'analysis',
  'realtime meta': 'realtimeSummaryMeta',
  'realtime insight': 'realtimeSummary',
  'hesitation evaluation': 'realtimeSummaryEval',
  summary: 'summary',
  'summary rewrite': 'summary',
  'session translation': 'translation',
  'entry translation': 'translation',
  'follow-up': 'followUp',
  compaction: 'tldr',
  'tool round': 'mcp',
};
const TEXT = '[{"text":"What happens next?","prompt":"What happens next in the rollout plan for this team?"}]';
const TOOL = { name: 'search_sessions', description: 'Search saved sessions', parameters: { type: 'object' } };

// The provider policy, written out independently of the serializers: what each family should send for a preset.
function expected(familyName, feature) {
  const family = FAMILIES[familyName];
  const preset = PRESETS[family.provider === 'gemini' && feature === 'analysis' ? 'analysisGemini' : feature];
  const reasoning = family.model.startsWith('gpt-5.6') && preset.reasoningEffort;
  const tokens =
    reasoning && reasoning !== 'none' && preset.reasoningMaxOutputTokens
      ? preset.reasoningMaxOutputTokens
      : preset.maxOutputTokens;
  if (family.provider === 'gemini') {
    const thinking =
      preset.thinkingBudget === undefined
        ? undefined
        : preset.thinkingBudget === 0
          ? { thinkingBudget: 128 } // gemini-2.5 pro cannot turn thinking off; 128 is its floor.
          : { thinkingBudget: preset.thinkingBudget };
    return {
      temperature: preset.temperature,
      maxOutputTokens: preset.maxOutputTokens,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    };
  }
  if (family.provider === 'chatgpt') return { max_output_tokens: tokens, reasoning: { effort: reasoning } };
  if (reasoning) return { max_completion_tokens: tokens, reasoning_effort: reasoning };
  return { temperature: preset.temperature, max_tokens: preset.maxOutputTokens };
}

function sent(url, body) {
  if (url.includes('streamGenerateContent')) return body.generationConfig;
  const keys = url.includes('/responses')
    ? ['temperature', 'max_output_tokens', 'reasoning']
    : ['temperature', 'max_tokens', 'max_completion_tokens', 'reasoning_effort'];
  return Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
}

function events(url, kind) {
  if (url.includes('/responses'))
    return kind === 'tool'
      ? [
          {
            type: 'response.output_item.done',
            item: { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: TOOL.name, arguments: '{}' },
          },
          { type: 'response.completed' },
        ]
      : [{ type: 'response.output_text.delta', delta: TEXT }, { type: 'response.completed' }];
  if (url.includes('streamGenerateContent'))
    return [
      {
        candidates: [
          { content: { parts: [kind === 'tool' ? { functionCall: { name: TOOL.name, args: {} } } : { text: TEXT }] } },
        ],
      },
    ];
  return [
    kind === 'tool'
      ? {
          choices: [
            { delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: TOOL.name, arguments: '{}' } }] } },
          ],
        }
      : { choices: [{ delta: { content: TEXT } }] },
  ];
}

// A stream that sends a partial answer, then waits until its request is aborted.
function hanging(url, signal, started) {
  const partial = url.includes('/responses')
    ? { type: 'response.output_text.delta', delta: 'PARTIAL' }
    : url.includes('streamGenerateContent')
      ? { candidates: [{ content: { parts: [{ text: 'PARTIAL' }] } }] }
      : { choices: [{ delta: { content: 'PARTIAL' } }] };
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(partial)}\n\n`));
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        started();
      },
    }),
  );
}

function environment(familyName) {
  const repos = createRepositories(openDatabase(':memory:'));
  repos.settings.update({
    ...FAMILIES[familyName],
    language: 'pt',
    translationLanguage: 'Spanish',
    autoCompact: false,
  });
  const assistantId = repos.assistants.save({ name: 'Matrix', prompt: 'Help with the rollout.' });
  const session = repos.sessions.create('Rollout', assistantId);
  for (let i = 0; i < 12; i++)
    repos.entries.add(session.id, 'transcript', `Line ${i}: we discussed the rollout plan for next week.`, 'THEY');
  const requests = [],
    plan = [];
  let onHang = () => {};
  const providers = new Providers(
    async () => 'fixture-key',
    async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body });
      const kind = plan.shift() || 'text';
      if (kind === 'hang') return hanging(url, options.signal, onHang);
      return new Response(
        events(url, kind)
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(''),
      );
    },
  );
  const active = createActiveSession();
  active.set(session.id);
  const registry = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const realtimePrompts = createRealtimePrompts({ providers, now: Date.now });
  const generation = createGeneration({
    sessions: {
      get: (id) => repos.sessions.get(id),
      updateModel: (id, m) => repos.sessions.updateModel(id, m),
      assistantFor: (id) => repos.assistants.forSession(id),
      addUserEntry: (id, q, generation) => repos.entries.add(id, 'user', q, '', null, generation),
      persistOutput: (s, mode, a, requestId) => persistGeneratedOutput(repos, s, mode, a, requestId),
    },
    settings: () => repos.settings.read(),
    active,
    requests: registry,
    acquireLocal: () => ({ release() {} }),
    notch: { canStartInsight: () => true, presentAnswer: () => null },
    compactor: { compact: async () => ({ summary: '' }) },
    providers,
    prepareContext: (options) => prepareSessionContext({ repositories: repos, providers, realtimePrompts, ...options }),
    summaryRewrite: { messages: summaryRewriteMessages, clean: cleanSummaryRewrite },
    requestImages: () => [],
    events: { ownerDelta() {}, overlayDelta() {}, answer() {}, finished() {}, automaticFailed() {} },
    changed() {},
  });
  let id = 0;
  const generate = (input) => {
    return generation.run({ requestId: `r${++id}`, sessionId: session.id, ...input }, { sender: { id: 1 } });
  };
  const signal = () => new AbortController().signal;
  const lastAnswer = () => repos.sessions.get(session.id).entries.findLast((entry) => entry.kind === 'assistant');
  const firstTheirs = () => repos.sessions.get(session.id).entries.find((entry) => entry.speaker === 'THEY');
  const compactor = createCompactor({
    sessions: { get: (sid) => repos.sessions.get(sid) },
    compactions: repos.compactions,
    providers,
    now: () => new Date(0),
    newId: () => `c${++id}`,
  });
  // Each runner performs the path and returns how many requests it made before the one that belongs to the path.
  const runners = {
    answer: () => generate({ mode: 'chat', question: 'What did we decide?' }),
    'screen insight': () => generate({ mode: 'screenInsight', context: 'Selected rollout text' }),
    'realtime meta': () => generate({ mode: 'insight' }),
    'realtime insight': () => generate({ mode: 'insight' }),
    'hesitation evaluation': () => generate({ mode: 'insightHesitation', liveTranscript: 'um let me think' }),
    summary: () => generate({ mode: 'summary' }),
    'summary rewrite': () => generate({ mode: 'summaryRewrite', draft: 'Old overview.', instructions: 'Shorter.' }),
    'session translation': () => generate({ mode: 'translation' }),
    'entry translation': (s = signal()) =>
      createEntryTranslation({ sessions: repos.sessions, providers }).translate(
        repos.settings.read(),
        { sessionId: session.id, entryId: firstTheirs().id, language: 'Spanish' },
        s,
      ),
    'follow-up': async (s = signal()) => {
      if (!lastAnswer()) await generate({ mode: 'chat', question: 'What did we decide?' });
      return createFollowUpGenerator({
        sessions: repos.sessions,
        assistants: repos.assistants,
        providers: providers,
      }).ask(repos.settings.read(), { sessionId: session.id, entryId: lastAnswer().id }, s);
    },
    compaction: (s = signal()) => compactor.compact(session.id, repos.settings.read(), s),
    // The model tool loop that asking your history uses: the round after a tool call.
    'tool round': (s = signal()) => {
      plan.push('tool', 'text');
      return providers.stream(
        repos.settings.read(),
        [{ role: 'user', content: 'Find the plan' }],
        () => {},
        s,
        undefined,
        {
          tools: [TOOL],
          handleTool: async () => 'Found the rollout plan.',
        },
      );
    },
  };
  return {
    repos,
    session,
    requests,
    plan,
    registry,
    runners,
    lastAnswer,
    hang: (started) => (onHang = started),
    close: () => repos.db.close(),
  };
}

// Which captured request belongs to the path: the meta request precedes the first insight, a follow-up may need an
// answer first, and the tool round is the request after the tool call.
async function capture(env, pathName) {
  if (pathName === 'realtime insight') await env.runners['realtime meta']();
  if (pathName === 'follow-up' && !env.lastAnswer()) await env.runners.answer();
  const before = env.requests.length;
  await env.runners[pathName]();
  const made = env.requests.slice(before);
  if (pathName === 'realtime meta') return made[0];
  return made.at(-1);
}

const matrix = [];
for (const familyName of Object.keys(FAMILIES))
  test(`every feature path sends its pinned preset on the ${familyName} route`, async (t) => {
    for (const [pathName, feature] of Object.entries(PATHS)) {
      const env = environment(familyName);
      t.after(env.close);
      const request = await capture(env, pathName);
      const params = sent(request.url, request.body);
      assert.deepEqual(params, expected(familyName, feature), `${familyName} / ${pathName}`);
      if (pathName === 'realtime meta')
        assert.match(JSON.stringify(request.body), /LearnTranscriber's real-time assistant/);
      assert.ok(!('generationFeature' in request.body), `${pathName} leaks configuration`);
      const model = request.url.includes('streamGenerateContent')
        ? decodeURIComponent(request.url.match(/models\/([^:]+):/)[1])
        : request.body.model;
      assert.equal(model, FAMILIES[familyName].model, `${familyName} / ${pathName} model`);
      matrix.push({ family: familyName, path: pathName, feature, model, params });
    }
  });

const CANCEL_START = { 'realtime insight': ['text'], 'tool round': ['tool'] };
for (const pathName of Object.keys(PATHS))
  test(`cancelling the in-flight ${pathName} request saves no partial answer`, async (t) => {
    const env = environment('openai');
    t.after(env.close);
    if (pathName === 'follow-up') await env.runners.answer();
    const before = env.repos.sessions.get(env.session.id);
    const controller = new AbortController();
    const started = new Promise((resolve) => env.hang(resolve));
    env.plan.push(...(CANCEL_START[pathName] || []), 'hang');
    const running = ['entry translation', 'follow-up', 'compaction', 'tool round'].includes(pathName)
      ? env.runners[pathName](controller.signal)
      : env.runners[pathName]();
    await started;
    controller.abort();
    env.registry.cancelAll();
    await assert.rejects(running);
    const after = env.repos.sessions.get(env.session.id);
    assert.ok(!JSON.stringify(after).includes('PARTIAL'), `${pathName} saved a partial answer`);
    assert.equal(after.summary, before.summary);
    assert.equal(after.translation, before.translation);
    assert.deepEqual(
      after.entries.filter((entry) => entry.kind === 'assistant'),
      before.entries.filter((entry) => entry.kind === 'assistant'),
    );
    if (pathName === 'realtime meta') {
      // Nothing was cached, so the next insight asks for the instruction again.
      const count = env.requests.length;
      await env.runners['realtime meta']();
      assert.match(JSON.stringify(env.requests[count].body), /LearnTranscriber's real-time assistant/);
    }
  });

test('the request matrix is written for the verification record when asked', () => {
  if (process.env.FP05_MATRIX_OUT) fs.writeFileSync(process.env.FP05_MATRIX_OUT, JSON.stringify(matrix, null, 2));
  assert.equal(matrix.length, Object.keys(FAMILIES).length * Object.keys(PATHS).length);
});
