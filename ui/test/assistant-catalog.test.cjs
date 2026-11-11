const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { BUILT_IN_IDS, categoryCounts, filterAssistants, isBuiltIn, paginate, sourceOf } = loadTs(
  'src/features/assistant-catalog.ts',
);

const assistant = (id, name, category, prompt = 'zzz') => ({ id, name, category, prompt });
const list = [
  assistant('a', 'Pasta', 'Cooking', 'Italian dinners'),
  assistant('b', 'Bread', 'Cooking'),
  assistant('c', 'Trains', 'Travel'),
  assistant('d', 'Atlas', 'Travel', 'maps and pasta stops'),
];
const names = (items) => items.map((item) => item.name);

test('the built-ins match the ids the main process seeds, and only the others are labelled Custom', () => {
  assert.deepEqual([...BUILT_IN_IDS], require('../../src/main/domain/assistants/built-in-catalog.cjs').BUILT_IN_IDS);
  assert.equal(isBuiltIn({ id: 'meeting' }), true);
  assert.equal(isBuiltIn({ id: 'study' }), false);
  assert.equal(sourceOf({ id: 'meeting' }), '');
  assert.equal(isBuiltIn({ id: 'a' }), false);
  assert.equal(sourceOf({ id: 'a' }), 'Custom');
});

test('categories are counted and listed alphabetically', () => {
  assert.deepEqual(
    [...categoryCounts(list)].map(([name, count]) => `${name}:${count}`),
    ['Cooking:2', 'Travel:2'],
  );
});

test('the filter keeps the chosen category, matches name, category, source or prompt, and sorts by name', () => {
  assert.deepEqual(names(filterAssistants(list, { query: '', category: 'all' })), [
    'Atlas',
    'Bread',
    'Pasta',
    'Trains',
  ]);
  assert.deepEqual(names(filterAssistants(list, { query: '', category: 'Travel' })), ['Atlas', 'Trains']);
  assert.deepEqual(names(filterAssistants(list, { query: '  PASTA ', category: 'all' })), ['Atlas', 'Pasta']);
  assert.deepEqual(names(filterAssistants(list, { query: 'cooking', category: 'all' })), ['Bread', 'Pasta']);
  assert.deepEqual(names(filterAssistants(list, { query: 'custom', category: 'Travel' })), ['Atlas', 'Trains']);
  assert.deepEqual(names(filterAssistants(list, { query: 'pasta', category: 'Cooking' })), ['Pasta']);
});

test('a page shows its slice and the 1-based range, and a page past the end shows the last page', () => {
  const items = Array.from({ length: 20 }, (_, index) => index + 1);
  const second = paginate(items, 8, 2);
  assert.deepEqual([...second.items], [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual([second.page, second.pageCount, second.first, second.last], [2, 3, 9, 16]);
  const beyond = paginate(items, 8, 9);
  assert.deepEqual([...beyond.items], [17, 18, 19, 20]);
  assert.deepEqual([beyond.page, beyond.first, beyond.last], [3, 17, 20]);
});

test('an empty list is one empty page with no range', () => {
  const empty = paginate([], 8, 1);
  assert.deepEqual([empty.items.length, empty.page, empty.pageCount, empty.first, empty.last], [0, 1, 1, 0, 0]);
});
