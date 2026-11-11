// The preview's assistant share format and builder action, now split from the library CRUD into their own modules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = {
  crypto,
  structuredClone,
  DOMException,
  setTimeout,
  URL,
  window: { setTimeout, location: { hash: '' } },
  navigator: { clipboard: { writeText: async () => undefined } },
};
function context() {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  return { ctx, assistants: loadTs('src/bridge/mock/assistants.ts', globals).assistantsApi(ctx) };
}

test('exporting then importing an assistant round-trips its prompts', async () => {
  const { ctx, assistants } = context();
  const id = await assistants.saveAssistant({ name: 'Coach', prompt: 'Help me study.' });
  let copied = '';
  globals.navigator.clipboard.writeText = async (value) => {
    copied = value;
  };
  await assistants.exportAssistant(id);
  assert.equal(JSON.parse(copied).type, 'learntranscriber.assistant-prompt');
  const draft = await assistants.importAssistant(copied);
  assert.equal(draft.name, 'Coach');
  assert.equal(draft.systemPrompt, 'Help me study.');
  assert.equal(draft.category, 'Uncategorized');
  assert.equal(
    ctx.assistants.some((item) => item.id === id),
    true,
  );
});

test('importAssistant rejects an envelope that is not the shared assistant format', async () => {
  const { assistants } = context();
  await assert.rejects(assistants.importAssistant(''), /Paste a shared assistant prompt/);
  await assert.rejects(assistants.importAssistant('not json'), /not a valid shared assistant prompt/);
  await assert.rejects(assistants.importAssistant(JSON.stringify({ type: 'other' })), /unsupported format/);
});

test('applyBuilderAction saves the draft through the same library saveAssistant path', async () => {
  const { ctx, assistants } = context();
  await assert.rejects(
    assistants.applyBuilderAction({ proposal: { tool: 'other', args: {}, token: 't' } }),
    /Unsupported builder action/,
  );
  const draft = {
    name: 'Built assistant',
    category: 'Career',
    systemPrompt: 'Prep questions.',
    realtimePrompt: '',
    followUpPrompt: '',
    emailPrompt: '',
    mcpDeterminationPrompt: '',
    mcpInterpretationPrompt: '',
    mcpNextActionPrompt: '',
    requireCertainty: true,
  };
  const result = await assistants.applyBuilderAction({
    proposal: { tool: 'save_assistant_draft', args: {}, token: 't' },
    draft,
  });
  assert.equal(result.name, 'Built assistant');
  assert.equal(
    ctx.assistants.some((item) => item.id === result.id && item.name === 'Built assistant'),
    true,
  );
});
