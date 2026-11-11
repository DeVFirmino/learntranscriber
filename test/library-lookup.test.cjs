const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findAssistant, searchLibrary, assistantDraft } = require('../src/main/domain/assistants/library-lookup.cjs');

const library = [
  { id: 'a1', name: 'Coach', category: 'Coaching', prompt: 'Ask.', require_certainty: 1 },
  { id: 'a2', name: 'Twin', category: 'Writing', prompt: 'Write.' },
  { id: 'a3', name: 'twin', category: 'Writing', prompt: 'Edit.' },
];

test('an assistant is found by ID, by a name passed as the ID, or by its name', () => {
  assert.equal(findAssistant(library, { assistant_id: 'a1' }).id, 'a1');
  assert.equal(findAssistant(library, { assistant_id: ' coach ' }).id, 'a1');
  assert.equal(findAssistant(library, { assistant_name: 'COACH' }).id, 'a1');
  assert.equal(findAssistant(library, { assistant_name: 'Missing' }), null);
  assert.equal(findAssistant(library, { assistant_name: '   ' }), null);
  assert.equal(findAssistant(library, {}), null);
});

test('a name shared by two assistants needs the ID', () => {
  assert.throws(() => findAssistant(library, { assistant_name: 'twin' }), /use its ID/);
  assert.equal(findAssistant(library, { assistant_id: 'a3' }).prompt, 'Edit.');
});

test('the library search filters by category and text and the draft keeps certainty strict', () => {
  assert.deepEqual(
    searchLibrary(library, { category: 'writing', query: 'edit' }).map((item) => item.id),
    ['a3'],
  );
  assert.equal(assistantDraft(library[0]).requireCertainty, false);
  assert.equal(assistantDraft({ ...library[0], require_certainty: true }).systemPrompt, 'Ask.');
});
