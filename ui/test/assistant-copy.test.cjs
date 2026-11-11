// Duplicating an assistant drafts every prompt, its context and knowledge under the new name, unsaved.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { duplicateDraft } = loadTs('src/features/assistants/assistant-copy.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('a full assistant becomes a draft with every field carried over', () => {
  const draft = duplicateDraft(
    {
      id: 'notes',
      name: 'Study notes',
      prompt: 'Summarize.',
      category: 'Education',
      realtime_prompt: 'Live.',
      follow_up_prompt: 'Follow.',
      email_prompt: 'Mail.',
      mcp_determination_prompt: 'Decide.',
      mcp_interpretation_prompt: 'Read.',
      mcp_next_action_prompt: 'Next.',
      context: 'Course notes',
      knowledge_files: [{ name: 'a.md' }],
      require_certainty: true,
      mcp_servers: ['notes'],
    },
    'Study notes (copy)',
  );
  assert.equal(draft.name, 'Study notes (copy)');
  assert.equal(draft.systemPrompt, 'Summarize.');
  assert.equal(draft.realtimePrompt, 'Live.');
  assert.equal(draft.followUpPrompt, 'Follow.');
  assert.equal(draft.emailPrompt, 'Mail.');
  assert.equal(draft.requireCertainty, true);
  assert.deepEqual(plain(draft.knowledgeFiles), [{ name: 'a.md' }]);
  assert.equal(
    Object.keys(draft).some((key) => key.startsWith('mcp')),
    false,
  );
});

test('an assistant with only a prompt gets empty texts, no files and certainty off', () => {
  const draft = duplicateDraft({ id: 'general', name: 'General', prompt: 'Help.' }, 'General (copy)');
  assert.equal(draft.followUpPrompt, '');
  assert.equal(draft.context, '');
  assert.deepEqual(plain(draft.knowledgeFiles), []);
  assert.equal(draft.requireCertainty, false);
  assert.equal(typeof draft.category, 'string');
});
