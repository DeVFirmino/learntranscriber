// FP04-S02/S03 fixtures: each of the four assistant prompt fields reaches only its own request path, and an empty
// field uses the recovered built-in default (system, follow-up, email) or the documented local fallback.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createGeneration } = require('../src/main/application/sessions/generate.cjs');
const { persistGeneratedOutput } = require('../src/main/application/sessions/generated-output.cjs');
const { prepareSessionContext } = require('../src/main/application/sessions/context-preparation.cjs');
const { createFollowUpGenerator } = require('../src/main/application/sessions/follow-up-generator.cjs');
const { createSessionNotes } = require('../src/main/application/sessions/session-notes.cjs');
const { BUILT_IN_DEFAULTS, FIELDS, resolvePrompt } = require('../src/main/domain/assistants/prompt-fallbacks.cjs');

const SENTINELS = {
  system: 'SENTINEL-SYSTEM',
  realtime: 'SENTINEL-REALTIME',
  followUp: 'SENTINEL-FOLLOWUP',
  email: 'SENTINEL-EMAIL',
};
const ANSWER = 'A grounded answer that is long enough to ask for suggested questions afterwards.';

function harness(t, assistantInput) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ provider: 'custom', customBaseUrl: 'http://127.0.0.1:1/v1', model: 'fixture' });
  const assistantId = repos.assistants.save(assistantInput);
  const session = repos.sessions.create('Planning', assistantId);
  repos.entries.add(session.id, 'transcript', 'We chose queues for the rollout.', 'THEY');
  const active = createActiveSession();
  active.set(session.id);
  const requests = [];
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
    requests: createRequestRegistry({ timers: { setTimeout, clearTimeout } }),
    acquireLocal: () => ({ release() {} }),
    notch: { canStartInsight: () => true, presentAnswer: () => null },
    compactor: { compact: async () => ({ summary: '' }) },
    providers: {
      checkContext: async () => {},
      stream: async (settings, messages, onDelta) => {
        const request = { path: null, settings, text: messages.map((m) => m.content).join('\n') };
        requests.push(request);
        onDelta(ANSWER);
        return ANSWER;
      },
    },
    prepareContext: (options) =>
      prepareSessionContext({ repositories: repos, providers: { checkContext: async () => {} }, ...options }),
    summaryRewrite: { messages: () => [], clean: (value) => value },
    requestImages: () => [],
    events: { ownerDelta() {}, overlayDelta() {}, answer() {}, finished() {}, automaticFailed() {} },
    changed() {},
  });
  let id = 0;
  const run = async (pathName, input) => {
    await generation.run({ requestId: `r${++id}`, sessionId: session.id, ...input }, { sender: { id: 1 } });
    const request = requests.at(-1);
    request.path = pathName;
    return request;
  };
  const followUp = async () => {
    const entry = repos.sessions.get(session.id).entries.findLast((item) => item.kind === 'assistant');
    const before = requests.length;
    await createFollowUpGenerator({
      sessions: repos.sessions,
      assistants: repos.assistants,
      providers: {
        checkContext: async () => {},
        stream: async (settings, messages) => {
          requests.push({ path: 'followUp', settings, text: messages.map((m) => m.content).join('\n') });
          return '[{"text":"Next?","prompt":"What happens next?"}]';
        },
      },
    }).ask(repos.settings.read(), { sessionId: session.id, entryId: entry.id }, new AbortController().signal);
    assert.equal(requests.length, before + 1);
    return requests.at(-1);
  };
  // The session's Markdown note is the path the email (TLDR) field guides.
  const note = async () => {
    const before = requests.length;
    await createSessionNotes({
      settings: () => repos.settings.read(),
      sessions: repos.sessions,
      assistants: repos.assistants,
      providers: {
        checkContext: async () => {},
        stream: async (settings, messages) => {
          requests.push({ path: 'note', settings, text: messages.map((m) => m.content).join('\n') });
          return '## Summary\nQueues.';
        },
      },
      route: { run: (settings, work) => work(settings) },
      files: { write: async () => '/notes/planning.md' },
      now: () => new Date(0),
    }).save({ sessionId: session.id }, new AbortController().signal);
    assert.equal(requests.length, before + 1);
    return requests.at(-1);
  };
  return { repos, session, assistantId, run, followUp, note };
}

const present = (text) =>
  Object.entries(SENTINELS)
    .filter(([, value]) => text.includes(value))
    .map(([key]) => key);

test('each of the four prompt fields reaches only its own request path', async (t) => {
  const f = harness(t, {
    name: 'Sentinel',
    prompt: SENTINELS.system,
    realtimePrompt: SENTINELS.realtime,
    followUpPrompt: SENTINELS.followUp,
    emailPrompt: SENTINELS.email,
  });
  const answer = await f.run('answer', { mode: 'chat', question: 'What did we choose?' });
  assert.deepEqual(present(answer.text), ['system']);
  const insight = await f.run('realtime insight', { mode: 'insight' });
  assert.deepEqual(present(insight.text), ['system', 'realtime']);
  const note = await f.note();
  assert.deepEqual(present(note.text), ['email']);
  const followUp = await f.followUp();
  assert.deepEqual(present(followUp.text), ['followUp']);
});

test('empty fields use the recovered built-in defaults or the documented local fallbacks', async (t) => {
  // A saved assistant always has a system prompt, so only the three optional fields are empty here.
  const f = harness(t, { name: 'Empty', prompt: 'BASE' });
  // Without a realtime prompt or a generated one, the insight uses the built-in default instruction as is.
  const insight = await f.run('realtime insight', { mode: 'insight' });
  assert.ok(insight.text.startsWith("You are LearnTranscriber's real-time assistant."));
  assert.doesNotMatch(insight.text, /BASE/);
  // The automatic note template brings its own detailed guidance, so the short default TL;DR is left out of it.
  const note = await f.note();
  assert.match(note.text, /Write detailed notes of this session/);
  assert.ok(!note.text.includes(BUILT_IN_DEFAULTS.email));
  f.repos.settings.update({ sessionNoteTemplate: 'general' });
  const general = await f.note();
  assert.ok(general.text.includes(`Summary guidance:\n${BUILT_IN_DEFAULTS.email}`));
  const followUp = await f.followUp();
  assert.ok(followUp.text.includes(`Follow this guidance exactly:\n${BUILT_IN_DEFAULTS.followUp}\n`));
});

test('a session whose assistant no longer exists falls back to the built-in system prompt', async (t) => {
  const f = harness(t, { name: 'Gone', prompt: 'Gone instructions.' });
  f.repos.db.prepare('DELETE FROM assistants WHERE id=?').run(f.assistantId);
  assert.equal(f.repos.assistants.forSession(f.assistantId), null);
  const answer = await f.run('answer', { mode: 'chat', question: 'What did we choose?' });
  assert.ok(answer.text.startsWith(`${BUILT_IN_DEFAULTS.system}\n`));
});

test('the resolver names where each path got its text', () => {
  assert.deepEqual(Object.keys(FIELDS), Object.keys(SENTINELS));
  assert.deepEqual(resolvePrompt('followUp', { follow_up_prompt: '  Own  ' }), { prompt: 'Own', source: 'assistant' });
  assert.deepEqual(resolvePrompt('email', { email_prompt: '   ' }), {
    prompt: BUILT_IN_DEFAULTS.email,
    source: 'built-in default',
  });
  assert.deepEqual(resolvePrompt('system', null), { prompt: BUILT_IN_DEFAULTS.system, source: 'built-in default' });
  assert.deepEqual(resolvePrompt('realtime', {}, { localDefault: 'mode guidance' }), {
    prompt: 'mode guidance',
    source: 'local default',
  });
  // The user-global layer sits between the assistant and the default, and only for fields that have one.
  const settings = { globalFollowUpPrompt: ' Global follow-up ' };
  assert.deepEqual(resolvePrompt('followUp', {}, { settings }), { prompt: 'Global follow-up', source: 'user global' });
  assert.deepEqual(resolvePrompt('followUp', { follow_up_prompt: 'Own' }, { settings }), {
    prompt: 'Own',
    source: 'assistant',
  });
  assert.deepEqual(
    resolvePrompt('system', null, { settings: { globalFollowUpPrompt: 'x' } }).source,
    'built-in default',
  );
  assert.throws(() => resolvePrompt('summary', {}), /Unknown assistant prompt field/);
});

test('user-global prompts reach the follow-up and note paths when the assistant leaves them empty', async (t) => {
  const f = harness(t, { name: 'Empty', prompt: 'BASE' });
  f.repos.settings.update({
    globalFollowUpPrompt: 'GLOBAL-FOLLOWUP',
    globalEmailPrompt: 'GLOBAL-EMAIL',
  });
  const note = await f.note();
  assert.ok(note.text.includes('Summary guidance:\nGLOBAL-EMAIL'));
  assert.ok(!note.text.includes(BUILT_IN_DEFAULTS.email));
  await f.run('answer', { mode: 'chat', question: 'What did we choose?' });
  const followUp = await f.followUp();
  assert.ok(followUp.text.includes('Follow this guidance exactly:\nGLOBAL-FOLLOWUP\n'));
});

test('global prompts accept long text and still refuse other long settings', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    repos.settings.update({ globalEmailPrompt: 'x'.repeat(20000) });
    assert.equal(repos.settings.read().globalEmailPrompt.length, 20000);
    assert.throws(() => repos.settings.update({ globalEmailPrompt: 'x'.repeat(20001) }), /too long/);
    assert.throws(() => repos.settings.update({ language: 'x'.repeat(2001) }), /too long/);
  } finally {
    repos.db.close();
  }
});

test('the selected assistant survives a restart and guides follow-ups on the follow-up generation preset', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp04-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'store.db');
  let repos = createRepositories(openDatabase(file));
  const chosen = repos.assistants.save({ name: 'Chosen', prompt: 'Be exact.', followUpPrompt: 'Ask about risks.' });
  repos.settings.update({
    assistantId: chosen,
    provider: 'custom',
    customBaseUrl: 'http://127.0.0.1:1/v1',
    model: 'm1',
  });
  repos.db.close();
  repos = createRepositories(openDatabase(file));
  t.after(() => repos.db.close());
  assert.equal(repos.settings.read().assistantId, chosen);
  const session = repos.sessions.create('Review', repos.settings.read().assistantId);
  const entry = repos.entries.add(session.id, 'assistant', ANSWER);
  let seen;
  await createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async () => {},
      stream: async (settings, messages) => {
        seen = { settings, text: messages.map((m) => m.content).join('\n') };
        return '[{"text":"Risks?","prompt":"Which risks remain?"}]';
      },
    },
  }).ask(repos.settings.read(), { sessionId: session.id, entryId: entry.id }, new AbortController().signal);
  assert.match(seen.text, /Follow this guidance exactly:\nAsk about risks\.\n/);
  assert.equal(seen.settings.model, 'm1');
  assert.equal(seen.settings.generationFeature, 'followUp');
});
