// The preview's follow-up questions and transcript translation, now split out of the streamed chat generation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = {
  crypto,
  structuredClone,
  DOMException,
  setTimeout,
  clearTimeout,
  URL,
  window: { setTimeout, clearTimeout },
};
function context() {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  return {
    ctx,
    sessions: loadTs('src/bridge/mock/sessions.ts', globals).sessionsApi(ctx),
    generation: loadTs('src/bridge/mock/generation.ts', globals).generationApi(ctx),
  };
}

test('followUps needs a saved assistant answer of at least 50 characters', async () => {
  const { ctx, sessions, generation } = context();
  const live = await sessions.createSession('Live');
  await assert.rejects(
    generation.followUps({ requestId: 'f1', sessionId: live.id, entryId: 'missing' }),
    /need a saved assistant answer/,
  );
  const entry = ctx.addEntry(live.id, 'assistant', 'A long enough answer to pass the fifty character minimum check.');
  const result = await generation.followUps({ requestId: 'f2', sessionId: live.id, entryId: entry.id });
  assert.equal(result.entryId, entry.id);
  assert.equal(result.suggestions.length, 3);
});

test('translateEntry only accepts a nonempty THEY transcript line and a chosen language', async () => {
  const { ctx, sessions, generation } = context();
  const live = await sessions.createSession('Live');
  const mine = ctx.addEntry(live.id, 'transcript', 'My own line', 'ME');
  await assert.rejects(
    generation.translateEntry({ requestId: 'r1', sessionId: live.id, entryId: mine.id, language: 'French' }),
    /nonempty participant transcript/,
  );
  const theirs = ctx.addEntry(live.id, 'transcript', 'Their line', 'THEY');
  await assert.rejects(
    generation.translateEntry({ requestId: 'r2', sessionId: live.id, entryId: theirs.id, language: '' }),
    /Choose a translation language/,
  );
  const translated = await generation.translateEntry({
    requestId: 'r3',
    sessionId: live.id,
    entryId: theirs.id,
    language: 'French',
  });
  assert.equal(translated.language, 'French');
  assert.match(translated.text, /Preview translation into French/);
});
