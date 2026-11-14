const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadTs } = require('./helpers/load-ts.cjs');
const fixtures = require('../../test/fixtures/contract-settings-assistants.json');

const globals = {
  crypto,
  structuredClone,
  DOMException,
  setTimeout,
  clearTimeout,
  URL,
  console,
  window: { setTimeout, clearTimeout },
};
function context() {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  return {
    ctx,
    settings: loadTs('src/bridge/mock/settings.ts', globals).settingsApi(ctx),
    assistants: loadTs('src/bridge/mock/assistants.ts', globals).assistantsApi(ctx),
    sessions: loadTs('src/bridge/mock/sessions.ts', globals).sessionsApi(ctx),
    generation: loadTs('src/bridge/mock/generation.ts', globals).generationApi(ctx),
  };
}
const outcome = async (promise) => {
  try {
    await promise;
    return 'accepts';
  } catch {
    return 'rejects';
  }
};

test('preview settings follow the shared contract fixtures', async () => {
  for (const item of fixtures.settings)
    assert.equal(await outcome(context().settings.settings(item.patch)), item.mock, item.name);
});

test('preview assistants follow the shared contract fixtures, including named differences', async () => {
  for (const item of fixtures.assistants)
    assert.equal(await outcome(context().assistants.saveAssistant(item.input)), item.mock, item.name);
  for (const item of fixtures.deletions)
    assert.equal(await outcome(context().assistants.deleteAssistant(item.id)), item.mock, item.name);
});

test('preview assistant deletion and built-in choices use the native alphabetical fallback and last-item guard', async () => {
  const { ctx, assistants } = context();
  assert.equal((await assistants.deleteAssistant('general')).selectedAssistantId, 'english');
  ctx.settings.assistantId = 'math';
  assert.deepEqual(JSON.parse(JSON.stringify(await assistants.chooseBuiltInAssistants(['english', 'meeting']))), {
    restored: [],
    removed: ['math', 'programming'],
  });
  assert.equal(ctx.settings.assistantId, 'english');
  assert.equal(ctx.settings.assistantsChosen, true);
  for (const id of ['meeting', 'notes']) await assistants.deleteAssistant(id);
  await assert.rejects(assistants.chooseBuiltInAssistants([]), /Keep at least one assistant/);
  await assert.rejects(assistants.deleteAssistant('english'), /Keep at least one assistant/);
  assert.deepEqual([...ctx.assistants.map((item) => item.id)], ['english']);
});

test('preview sharing exports and imports exactly the native fields after tool removal', async () => {
  const { exportAssistant, importAssistant } = require('../../src/main/domain/assistants/package.cjs');
  const { ctx } = context();
  let clipboard;
  const sharing = loadTs('src/bridge/mock/assistant-sharing.ts', {
    ...globals,
    navigator: {
      clipboard: {
        writeText: async (value) => {
          clipboard = value;
        },
      },
    },
  }).assistantSharingApi(ctx);
  const assistant = ctx.assistants[0];
  await sharing.exportAssistant(assistant.id);
  assert.equal(clipboard, exportAssistant(assistant));
  const legacy = JSON.parse(clipboard);
  legacy.assistant.mcpNextActionPrompt = 42;
  const raw = JSON.stringify(legacy);
  assert.deepEqual(JSON.parse(JSON.stringify(await sharing.importAssistant(raw))), importAssistant(raw));
});

test('preview sessions keep the native guards and publish each change', async () => {
  const { ctx, sessions } = context();
  let published = 0;
  ctx.changes.subscribe(() => published++);
  const live = await sessions.createSession('Live');
  await assert.rejects(sessions.createSession('Second'), /End the active session before creating another/);
  await assert.rejects(sessions.deleteSession(live.id), /End the session before deleting it/);
  await assert.rejects(sessions.clearHistory(), /End the active session before clearing history/);
  await assert.rejects(
    sessions.updateSummary({ id: live.id, summary: 'New', expectedSummary: 'stale' }),
    /Overview changed in another window/,
  );
  await sessions.endSession(live.id);
  assert.equal(ctx.state.activeSessionId, null);
  assert.equal(published, 2);
});

test('preview generation streams locally, refuses duplicates and honours cancellation', async () => {
  const { ctx, sessions, generation } = context();
  const live = await sessions.createSession('Live');
  const deltas = [];
  const off = ctx.deltas.subscribe((value) => deltas.push(value.delta));
  const answer = await generation.generate({ requestId: 'r1', sessionId: live.id, mode: 'chat', question: 'Hello?' });
  assert.match(answer, /^Preview answer\. No model was contacted\./);
  assert.equal(deltas.join(''), answer);
  off();
  const running = generation.generate({ requestId: 'r2', sessionId: live.id, mode: 'chat', question: 'Again?' });
  await assert.rejects(
    generation.generate({ requestId: 'r2', sessionId: live.id, mode: 'chat', question: 'Dup' }),
    /Request ID already in use/,
  );
  await generation.cancel('r2');
  await assert.rejects(running, /cancelled/);
  await assert.rejects(
    generation.generate({ requestId: 'r3', sessionId: live.id, mode: 'compact' }),
    /Invalid generation mode/,
  );
});

// The method names the native preload exposes, read by running preload.cjs against a stand-in for Electron.
function preloadMethods() {
  let exposed = null;
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, api) => (exposed = api) },
    ipcRenderer: { invoke: async () => ({ ok: true }), on: () => {}, removeListener: () => {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '../../src/main/preload.cjs'), 'utf8');
  vm.runInNewContext(source, { require: (name) => (name === 'electron' ? electron : require(name)) });
  return Object.keys(exposed).sort();
}

test('the browser preview exposes exactly the methods of the native preload', () => {
  const { createMockWorkspace } = loadTs('src/bridge/mock.ts', globals);
  assert.deepEqual(Object.keys(createMockWorkspace()).sort(), preloadMethods());
});

test('preview batch deletion matches native validation and counts unique normalized ids', async () => {
  const h = context();
  const id = h.ctx.study.id;
  const before = h.ctx.sessions.size;
  for (const input of [null, id, {}, [], [id, ''], [id, 42], [id, 'x'.repeat(101)], Array(201).fill(id)]) {
    await assert.rejects(h.sessions.deleteSessions(input));
    assert.equal(h.ctx.sessions.size, before, 'invalid batches must not delete an earlier valid id');
  }
  assert.equal(await h.sessions.deleteSessions([` ${id} `, id]), 1);
  assert.equal(h.ctx.sessions.size, before - 1);
});

test('preview Apple Speech defaults to automatic, reports its primary language and names both in sessions', async () => {
  const { ctx, sessions } = context();
  const audio = loadTs('src/bridge/mock/audio.ts', globals).audioApi(ctx);
  assert.equal(ctx.settings.appleSpeechLocale, 'auto');
  assert.equal((await audio.speechCapabilities()).locale, 'en-US');
  ctx.settings.transcriptionProvider = 'apple';
  assert.equal((await sessions.createSession('Class')).transcription_model, 'Apple Speech (Auto EN + PT)');
  const { sessionMetadata } = require('../../src/main/domain/sessions/rules.cjs');
  assert.equal(
    sessionMetadata({ transcriptionProvider: 'apple', appleSpeechLocale: 'auto' }, {}).transcriptionModel,
    'Apple Speech (Auto EN + PT)',
  );
});
