const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/assistant-categories.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports });
const { canonicalCategory, inferCategory, resolveCategory } = moduleValue.exports;

test('known ids, names and aliases canonicalize case-insensitively', () => {
  assert.equal(canonicalCategory('meetings'), 'meetings');
  assert.equal(canonicalCategory('  Meeting '), 'meetings');
  assert.equal(canonicalCategory('Reuniões'), 'meetings');
  assert.equal(canonicalCategory('DEV'), 'engineering');
  assert.equal(canonicalCategory('Family recipes'), null);
  assert.equal(canonicalCategory(''), null);
});
test('a missing category is inferred from the first matching keyword across prompt fields', () => {
  assert.equal(
    inferCategory({ name: 'Queue helper', prompt: 'Debug the API and read the stack trace.' }),
    'engineering',
  );
  assert.equal(
    inferCategory({
      name: 'Call notes',
      prompt: 'Summarize',
      follow_up_prompt: 'List each action item from the meeting.',
    }),
    'meetings',
  );
  assert.equal(inferCategory({ name: 'Pipeline review', prompt: 'Handle objection on each deal.' }), 'sales');
  assert.equal(inferCategory({ name: 'Plain', prompt: 'Be kind.' }), null);
  assert.equal(
    inferCategory({ name: 'Decoder', prompt: 'Decode messages.' }),
    null,
    'keywords match word starts, not substrings inside words',
  );
});
test('custom labels survive; built-in and custom fallbacks differ', () => {
  assert.deepEqual(
    { ...resolveCategory({ category: 'Family recipes', prompt: 'Explain the code' }, false) },
    { id: null, label: 'Family recipes' },
  );
  assert.deepEqual(
    { ...resolveCategory({ category: 'Uncategorized', prompt: 'Translate this to Spanish.' }, false) },
    { id: 'translation', label: 'Translation' },
  );
  assert.deepEqual(
    { ...resolveCategory({ category: '', prompt: 'Be kind.' }, true) },
    { id: 'general', label: 'General' },
  );
  assert.deepEqual(
    { ...resolveCategory({ category: '', prompt: 'Be kind.' }, false) },
    { id: null, label: 'Uncategorized' },
  );
  assert.deepEqual(
    { ...resolveCategory({ category: 'study', prompt: '' }, false) },
    { id: 'education', label: 'Education' },
  );
});
