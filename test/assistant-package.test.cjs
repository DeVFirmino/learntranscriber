const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { messagesFor } = require('../src/main/application/sessions/context-preparation.cjs');
const { exportAssistant, importAssistant } = require('../src/main/domain/assistants/package.cjs');

test('shared prompt excludes private context while preserving the four prompts', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const id = repos.assistants.save({
      name: 'Research',
      prompt: 'Ground answers.',
      category: 'Research',
      realtimePrompt: 'Short answer.',
      followUpPrompt: 'Ask next.',
      emailPrompt: 'Summarize.',
      context: 'Private notes',
      requireCertainty: true,
    });
    const payload = exportAssistant(repos.assistants.all().find((item) => item.id === id));
    assert.equal(JSON.parse(payload).type, 'learntranscriber.assistant-prompt');
    assert.doesNotMatch(payload, /Private notes|mcp|"id"/);
    const draft = importAssistant(`\`\`\`json\n${payload}\n\`\`\``);
    assert.equal(draft.name, 'Research');
    assert.equal(draft.emailPrompt, 'Summarize.');
    assert.equal(draft.requireCertainty, true);
    assert.equal(draft.context, undefined);
  } finally {
    repos.db.close();
  }
});

test('a shared package with tool prompts imports without them', () => {
  const draft = importAssistant(
    JSON.stringify({
      type: 'learntranscriber.assistant-prompt',
      version: 1,
      assistant: { name: 'Tools', systemPrompt: 'Help.', mcpDeterminationPrompt: 'Choose a tool.' },
    }),
  );
  assert.equal(draft.systemPrompt, 'Help.');
  assert.equal(draft.mcpDeterminationPrompt, undefined);
});

test('shared prompt rejects wrong formats and invalid fields without saving', () => {
  assert.throws(() => importAssistant(''), /Paste a shared assistant/);
  assert.throws(() => importAssistant('not json'), /not a valid shared/);
  assert.throws(() => importAssistant('{"type":"other","version":1,"assistant":{}}'), /unsupported format/);
  assert.throws(
    () => importAssistant('{"type":"learntranscriber.assistant-prompt","version":1,"assistant":{"systemPrompt":[]}}'),
    /invalid prompt fields/,
  );
  assert.throws(() => importAssistant('x'.repeat(250001)), /too large/);
});

test('deleting an active custom assistant keeps past session instructions and selects General', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const id = repos.assistants.save({ name: 'Temporary', prompt: 'Answer with the session facts.' });
    const session = repos.sessions.create('Old session', id);
    repos.settings.update({ assistantId: id });
    assert.equal(repos.assistants.delete(id).selectedAssistantId, 'general');
    assert.equal(repos.settings.read().assistantId, 'general');
    assert.ok(!repos.assistants.all().some((item) => item.id === id));
    assert.equal(repos.sessions.get(session.id).assistant_id, id);
    assert.equal(repos.assistants.forSession(id)?.prompt, 'Answer with the session facts.');
    assert.match(messagesFor(repos, session.id, 'chat', 'Question')[0].content, /Answer with the session facts/);
    assert.throws(() => repos.sessions.create('New session', id), /existing assistant/);
  } finally {
    repos.db.close();
  }
});
