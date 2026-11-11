const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { DEMO_ASSISTANTS, selectDemoAssistant, compareDemoAssistant } = loadTs(
  'src/features/onboarding/demo-assistants.ts',
);

test('the sample defaults to General and comparison returns to the previous assistant', () => {
  assert.equal(selectDemoAssistant('').assistant, 'general');
  for (const id of DEMO_ASSISTANTS.filter((value) => value !== 'notes')) {
    const selected = selectDemoAssistant(id);
    const compared = compareDemoAssistant(selected);
    assert.equal(compared.assistant, 'notes');
    assert.equal(compared.comparedFrom, id);
    assert.equal(selected.assistant, id);
    const restored = compareDemoAssistant(compared);
    assert.equal(restored.assistant, id);
    assert.equal(restored.comparedFrom, null);
  }
});

test('explicit selection ends a comparison, and selecting notes does not compare with itself', () => {
  const notes = selectDemoAssistant('notes');
  assert.equal(compareDemoAssistant(notes), notes);
  assert.equal(selectDemoAssistant('english').comparedFrom, null);
});
