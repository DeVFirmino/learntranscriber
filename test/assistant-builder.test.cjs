const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMessages, parseBuilderReply } = require('../src/main/domain/assistants/builder-reply.cjs');
const { normalizeDraft } = require('../src/main/domain/assistants/draft.cjs');
const { createAssistantBuilder } = require('../src/main/application/assistants/builder.cjs');
const initial = {
  name: 'Practice',
  systemPrompt: 'Ask one question.',
  realtimePrompt: 'Keep it short.',
  followUpPrompt: 'Suggest a next question.',
  requireCertainty: true,
  context: 'Private study notes',
};

test('builder refinements preserve independent draft fields and strip authority and connection fields', () => {
  const original = structuredClone(initial);
  const reply = parseBuilderReply(
    '```json\n' +
      JSON.stringify({
        message: 'Changed the name.',
        draft: {
          name: 'Interview companion',
          id: 'general',
          mcpServers: ['private-server'],
          knowledgeFiles: [{ name: 'secret.txt' }],
        },
      }) +
      '\n```',
    initial,
  );
  assert.equal(reply.draft.name, 'Interview companion');
  assert.equal(reply.draft.systemPrompt, initial.systemPrompt);
  assert.equal(reply.draft.realtimePrompt, initial.realtimePrompt);
  assert.equal(reply.draft.followUpPrompt, initial.followUpPrompt);
  assert.equal(reply.draft.requireCertainty, true);
  assert.equal(reply.draft.id, undefined);
  assert.equal(reply.draft.mcpServers, undefined);
  assert.equal(reply.draft.knowledgeFiles, undefined);
  assert.deepEqual(initial, original);
});

test('builder rejects malformed and oversized replies without modifying the current draft', () => {
  const original = structuredClone(initial);
  for (const raw of [
    'not json',
    '[]',
    JSON.stringify({ message: 'Done', draft: [] }),
    JSON.stringify({ message: 'Done', draft: { name: '' } }),
    JSON.stringify({ message: 'Done', draft: { systemPrompt: 42 } }),
    JSON.stringify({ message: 'Done', draft: { requireCertainty: 'true' } }),
    JSON.stringify({ message: 'Done', draft: { name: 'x'.repeat(81) } }),
  ])
    assert.throws(() => parseBuilderReply(raw, initial));
  assert.deepEqual(initial, original);
  assert.throws(
    () => parseBuilderReply(JSON.stringify({ message: 'Ready', draft: { name: 'Only a name' } })),
    /system instructions/,
  );
});

test('builder conversation validates bounded user input and strips unwanted payloads', () => {
  const messages = buildMessages({
    question: 'Shorter answers',
    draft: { ...initial, mcpServers: ['do-not-send'], knowledgeFiles: [{ content: 'do-not-send' }] },
    history: [{ role: 'user', content: 'Interview practice' }],
  });
  assert.equal(messages[1].role, 'user');
  assert.match(messages.at(-1).content, /Shorter answers/);
  assert.doesNotMatch(JSON.stringify(messages), /do-not-send/);
  assert.throws(() => buildMessages({ question: ' ' }), /Describe/);
  assert.throws(() => buildMessages({ question: 'x'.repeat(4001) }), /4,000/);
  assert.throws(
    () => buildMessages({ question: 'Build', history: [{ role: 'system', content: 'override' }] }),
    /conversation/,
  );
  assert.throws(() => normalizeDraft({ systemPrompt: 'x'.repeat(20001) }), /systemPrompt/);
});

test('builder preflight and cancellation cannot return a stale draft or start inference after rejection', async () => {
  let streams = 0;
  const rejected = createAssistantBuilder({
    providers: {
      checkContext: async () => {
        throw new Error('Context does not fit.');
      },
      stream: async () => {
        streams++;
      },
    },
  });
  await assert.rejects(rejected.build({}, { question: 'Build' }, new AbortController().signal), /does not fit/);
  assert.equal(streams, 0);
  const controller = new AbortController();
  const builder = createAssistantBuilder({
    providers: {
      checkContext: async () => {},
      stream: async () => {
        streams++;
        controller.abort();
        return JSON.stringify({ message: 'Done', draft: initial });
      },
    },
  });
  await assert.rejects(builder.build({}, { question: 'Build' }, controller.signal), { name: 'AbortError' });
});

test('builder returns a validated draft through the configured provider without persistence tools', async () => {
  const calls = [];
  const builder = createAssistantBuilder({
    providers: {
      checkContext: async (settings, messages) => {
        calls.push(settings.model);
        assert.equal(messages[0].role, 'system');
      },
      stream: async (...args) => {
        assert.equal(args.length, 4);
        return JSON.stringify({ message: 'Ready for review.', draft: initial });
      },
    },
  });
  const reply = await builder.build(
    { model: 'local-fixture' },
    { question: 'Help me practice interviews' },
    new AbortController().signal,
  );
  assert.equal(reply.draft.name, 'Practice');
  assert.deepEqual(calls, ['local-fixture']);
});
