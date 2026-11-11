const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { roleMark, ROLE_MARKS, CUSTOM_MARKS } = loadTs('src/features/assistants/assistant-glyphs.ts');
const { BUILT_IN_IDS } = loadTs('src/features/assistant-catalog.ts');

test('every built-in role has its own mark and General keeps the plain person', () => {
  for (const id of BUILT_IN_IDS.filter((item) => item !== 'general')) assert.ok(roleMark(id, true), id);
  assert.equal(roleMark('general', true), undefined);
  assert.deepEqual(
    Object.keys(ROLE_MARKS).filter((id) => !BUILT_IN_IDS.includes(id)),
    [],
  );
});

test('a custom assistant keeps one of the sixteen avatars, and new ones spread across them', () => {
  assert.equal(CUSTOM_MARKS.length, 16);
  assert.equal(new Set(CUSTOM_MARKS).size, CUSTOM_MARKS.length);
  const id = '3f2b8c1e-5d4a-4b7e-9c0f-1a2b3c4d5e6f';
  assert.ok(CUSTOM_MARKS.includes(roleMark(id, false)));
  assert.equal(roleMark(id, false), roleMark(id, false));
  assert.ok(CUSTOM_MARKS.includes(roleMark('toString', false)));
  const used = new Set(Array.from({ length: 200 }, (_, index) => roleMark(`custom-${index}`, false)));
  assert.equal(used.size, CUSTOM_MARKS.length);
  for (const mark of CUSTOM_MARKS) assert.ok(!Object.values(ROLE_MARKS).includes(mark));
});
