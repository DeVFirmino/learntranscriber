const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { assistantPickerOptions } = loadTs('src/features/assistants/picker-options.ts');

test('the floating picker shows one label per assistant name and retains the selected identity', () => {
  const assistants = [
    { id: 'built-in', name: 'General assistant' },
    { id: 'imported', name: ' general   assistant ' },
    { id: 'study', name: 'Study companion' },
  ];
  const before = JSON.stringify(assistants);
  const shown = assistantPickerOptions(assistants, 'imported');
  assert.deepEqual(
    Array.from(shown, (item) => item.id),
    ['imported', 'study'],
  );
  assert.equal(JSON.stringify(assistants), before);
  assert.deepEqual(
    Array.from(assistantPickerOptions(assistants, 'study'), (item) => item.id),
    ['built-in', 'study'],
  );
});

test('the floating picker pages three assistants at a time and opens on the selected one', () => {
  const { PICKER_PAGE_SIZE, pickerPageOf } = loadTs('src/features/assistants/picker-options.ts');
  const { paginate } = loadTs('src/features/assistant-catalog.ts');
  const options = Array.from({ length: 8 }, (_, index) => ({ id: `a${index}`, name: `A${index}` }));
  assert.equal(PICKER_PAGE_SIZE, 3);
  assert.equal(pickerPageOf(options, 'a0'), 1);
  assert.equal(pickerPageOf(options, 'a2'), 1);
  assert.equal(pickerPageOf(options, 'a3'), 2);
  assert.equal(pickerPageOf(options, 'a7'), 3);
  assert.equal(pickerPageOf(options, 'missing'), 1);
  const last = paginate(options, PICKER_PAGE_SIZE, 3);
  assert.deepEqual(
    Array.from(last.items, (item) => item.id),
    ['a6', 'a7'],
  );
  assert.equal(last.pageCount, 3);
  assert.equal(paginate(options, PICKER_PAGE_SIZE, 9).page, 3);
});
