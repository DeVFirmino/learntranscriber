const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createFollowUpGenerator } = require('../src/main/application/sessions/follow-up-generator.cjs');
const { parseSuggestions } = require('../src/main/domain/sessions/follow-up-suggestions.cjs');

test('suggestion parsing accepts fences, trims pairs and bounds model output', () => {
  assert.deepEqual(
    parseSuggestions('```json\n[{"text":" Next ","prompt":" Explain why "},{"text":" ","prompt":"ignored"},null]\n```'),
    [{ text: 'Next', prompt: 'Explain why' }],
  );
  assert.equal(parseSuggestions(JSON.stringify(Array(9).fill({ text: 'Next', prompt: 'Why?' }))).length, 5);
  assert.deepEqual(
    parseSuggestions(
      JSON.stringify([
        { text: 'x'.repeat(161), prompt: 'Why?' },
        { text: 'Next', prompt: 'x'.repeat(2001) },
      ]),
    ),
    [],
  );
  for (const raw of ['not json', '{}', 'x'.repeat(20001)]) assert.throws(() => parseSuggestions(raw));
});

test('suggestions require the latest sufficiently long answer and never persist entries', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const assistantId = repos.assistants.save({
    name: 'Practice',
    prompt: 'Help practice.',
    followUpPrompt: 'Ask about assumptions in Portuguese.',
  });
  const session = repos.sessions.create('Practice', assistantId);
  let calls = 0;
  const service = createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async (settings, messages) => {
        assert.equal(settings.model, 'fixture');
        assert.equal(settings.generationFeature, 'followUp');
        assert.equal(settings.generationConfig.maxOutputTokens, 300);
        assert.match(messages[0].content, /assumptions in Portuguese/);
        assert.equal(messages[1].content, 'a'.repeat(50));
      },
      stream: async (...args) => {
        calls++;
        assert.equal(args.length, 4);
        return '[{"text":"Why?","prompt":"Explain the assumptions."}]';
      },
    },
  });
  const short = repos.entries.add(session.id, 'assistant', 'a'.repeat(49));
  await assert.rejects(
    service.ask({}, { sessionId: session.id, entryId: short.id }, new AbortController().signal),
    /50 characters/,
  );
  assert.equal(calls, 0);
  const answer = repos.entries.add(session.id, 'assistant', 'a'.repeat(50));
  const before = repos.sessions.get(session.id);
  const result = await service.ask(
    { model: 'fixture' },
    { sessionId: session.id, entryId: answer.id },
    new AbortController().signal,
  );
  assert.equal(result.entryId, answer.id);
  assert.equal(result.suggestions[0].prompt, 'Explain the assumptions.');
  assert.deepEqual(repos.sessions.get(session.id), before);
  assert.throws(() => service.source(session.id, short.id), /latest/);
});

test('preflight failure and cancellation cannot start or return stale suggestions', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Practice', 'general'),
    answer = repos.entries.add(session.id, 'assistant', 'a'.repeat(60));
  const input = { sessionId: session.id, entryId: answer.id };
  let streams = 0;
  const rejected = createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async () => {
        throw new Error('Context does not fit');
      },
      stream: async () => {
        streams++;
      },
    },
  });
  await assert.rejects(rejected.ask({}, input, new AbortController().signal), /does not fit/);
  assert.equal(streams, 0);
  const controller = new AbortController();
  const cancelled = createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async () => {},
      stream: async () => {
        controller.abort();
        return '[]';
      },
    },
  });
  await assert.rejects(cancelled.ask({}, input, controller.signal), { name: 'AbortError' });
  const changed = createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async () => {},
      stream: async () => {
        repos.entries.add(session.id, 'assistant', 'b'.repeat(60));
        return '[]';
      },
    },
  });
  await assert.rejects(changed.ask({}, input, new AbortController().signal), /latest/);
});

test('Notch history can request an older saved assistant answer without changing latest-only callers', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('History', 'general');
  const older = repos.entries.add(
    session.id,
    'assistant',
    'Earlier answer with enough context to suggest a useful next question.',
  );
  repos.entries.add(session.id, 'assistant', 'Later answer with enough context to remain the latest response.');
  const service = createFollowUpGenerator({
    sessions: repos.sessions,
    assistants: repos.assistants,
    providers: {
      checkContext: async () => {},
      stream: async () => '[{"text":"Review earlier","prompt":"What did the earlier answer imply?"}]',
    },
  });
  assert.throws(() => service.source(session.id, older.id), /latest/);
  const result = await service.ask(
    {},
    { sessionId: session.id, entryId: older.id },
    new AbortController().signal,
    true,
  );
  assert.equal(result.entryId, older.id);
  assert.equal(result.suggestions[0].text, 'Review earlier');
});
