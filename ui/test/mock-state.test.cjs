// The preview's state parts: the published state is a copy, shortcuts carry the saved overrides, answers stream word
// by word until cancelled, and the sample library is the same each time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = { structuredClone, DOMException, setTimeout, window: { setTimeout }, Promise, Error, JSON, crypto };
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the shortcut definitions start from their defaults and apply the saved overrides', () => {
  const { shortcutDefinitions } = loadTs('src/bridge/mock/shortcut-definitions.ts', globals);
  const defaults = shortcutDefinitions('{}');
  const hide = defaults.find((item) => item.id === 'hide');
  assert.equal(hide.accelerator, 'CommandOrControl+B');
  assert.equal(hide.defaultAccelerator, 'CommandOrControl+B');
  assert.equal(defaults.find((item) => item.id === 'moveLeft').enabled, false);
  const saved = shortcutDefinitions(JSON.stringify({ hide: { accelerator: 'CommandOrControl+J', enabled: false } }));
  const changed = saved.find((item) => item.id === 'hide');
  assert.equal(changed.accelerator, 'CommandOrControl+J');
  assert.equal(changed.enabled, false);
  assert.equal(changed.defaultAccelerator, 'CommandOrControl+B');
});

test('the published state is a copy, sorted newest first, with bar rows only while the panel is collapsed', () => {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  const published = ctx.publicState();
  assert.deepEqual(plain(published.sessions.map((session) => session.id)), ['preview-plan', 'preview-study']);
  published.settings.model = 'changed';
  assert.equal(ctx.settings.model, 'preview-model');
  assert.deepEqual(plain(published.overlay.barRows), { prompt: false, preview: false, guide: false });
  ctx.state.activeSessionId = 'preview-plan';
  ctx.state.overlayExpanded = false;
  assert.equal(ctx.publicState().overlay.barRows.prompt, true);
  assert.equal(ctx.publicState().shortcutDefinitions.length, 22);
});

test('an answer streams word by word to the chat and the overlay until cancelled', async () => {
  const { createMockEvents } = loadTs('src/bridge/mock/events.ts', globals);
  const { createWordStream } = loadTs('src/bridge/mock/word-stream.ts', globals);
  const events = createMockEvents();
  const heard = { chat: [], overlay: [] };
  events.deltas.subscribe((value) => heard.chat.push(value.delta));
  events.overlayDeltas.subscribe((value) => heard.overlay.push(value.delta));
  const jobs = new Map([['chat', { cancelled: false }]]);
  const stream = createWordStream(jobs, events);
  await stream('chat', 'two words');
  assert.deepEqual(heard.chat, ['two', ' ', 'words']);
  assert.deepEqual(heard.overlay, ['two', ' ', 'words']);
  await assert.rejects(stream('missing', 'x'), /cancelled/);
  jobs.set('stopped', { cancelled: true });
  await assert.rejects(stream('stopped', 'x'), /cancelled/);
});

test('the sample library and settings are fresh copies with a custom provider that reaches nothing', () => {
  const library = loadTs('src/bridge/mock/library-fixtures.ts', globals);
  const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts', globals);
  assert.notEqual(library.previewSessions().study, library.previewSessions().study);
  assert.equal(library.previewSessions().study.entries.length, 4);
  assert.deepEqual(plain(library.previewAssistants().map((assistant) => assistant.id)), [
    ...plain(loadTs('src/features/assistant-catalog.ts').BUILT_IN_IDS),
    'notes',
  ]);
  assert.equal(previewSettings().provider, 'custom');
  assert.match(previewSettings().transcriptionBaseUrl, /^http:\/\/127\.0\.0\.1:9\//);
});

test('mock generation preserves identity in streamed events and saved chat/insight entries', async () => {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const { chatGenerationApi } = loadTs('src/bridge/mock/chat-generation.ts', globals);
  const ctx = createMockContext();
  const api = chatGenerationApi(ctx);
  const seen = [];
  ctx.overlayDeltas.subscribe((value) => seen.push(value));
  ctx.overlayAnswers.subscribe((value) => seen.push(value));
  ctx.overlayFinished.subscribe((value) => seen.push(value));
  for (const mode of ['chat', 'insight', 'screenInsight']) {
    await api.generate({ requestId: `mock-${mode}`, sessionId: 'preview-study', mode, question: 'Hello' });
    const events = seen.filter((event) => event.requestId === `mock-${mode}`);
    assert.ok(events.length > 2);
    assert.ok(events.every((event) => event.mode === mode && event.sessionId === 'preview-study'));
    const saved = ctx.requireSession('preview-study').entries.filter((entry) => entry.request_id === `mock-${mode}`);
    assert.equal(saved.length, mode === 'chat' ? 2 : 1);
    assert.ok(saved.every((entry) => entry.generation_mode === mode));
  }
});

test('mock terminal events separate cancellation from failure while keeping error details out of payloads', async () => {
  for (const reason of ['cancelled', 'error']) {
    const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
    const { chatGenerationApi } = loadTs('src/bridge/mock/chat-generation.ts', globals);
    const ctx = createMockContext();
    const finished = [];
    ctx.overlayFinished.subscribe((value) => finished.push(value));
    ctx.stream = async (id) => {
      if (reason === 'cancelled') ctx.jobs.get(id).cancelled = true;
      throw new Error('Provider private detail');
    };
    const api = chatGenerationApi(ctx);
    await assert.rejects(
      api.generate({ requestId: 'stopped', sessionId: 'preview-study', mode: 'chat', question: 'Hi' }),
    );
    assert.equal(finished[0].outcome, reason);
    assert.equal(finished[0].errorCode, reason === 'error' ? 'generationFailed' : undefined);
    assert.doesNotMatch(JSON.stringify(finished), /private detail/);
    assert.equal(
      ctx.requireSession('preview-study').entries.filter((entry) => entry.request_id === 'stopped').length,
      1,
    );
  }
});

test('mock summaries accept ended chat-only sessions and preserve the saved summary when generation fails', async () => {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const { chatGenerationApi } = loadTs('src/bridge/mock/chat-generation.ts', globals);
  const ctx = createMockContext();
  const session = ctx.requireSession('preview-study');
  session.entries = session.entries.filter((entry) => entry.kind !== 'transcript');
  session.ended_at = '2026-11-05';
  ctx.state.activeSessionId = null;
  assert.ok(session.entries.length);
  const api = chatGenerationApi(ctx);
  await api.generate({ requestId: 'summary', sessionId: session.id, mode: 'summary' });
  assert.match(session.summary, /Overview:/);
  const saved = session.summary;
  const failing = chatGenerationApi({
    ...ctx,
    stream: async () => {
      throw new Error('Provider failed');
    },
  });
  await assert.rejects(
    failing.generate({ requestId: 'failed-summary', sessionId: session.id, mode: 'summary' }),
    /Provider failed/,
  );
  assert.equal(session.summary, saved);
});
