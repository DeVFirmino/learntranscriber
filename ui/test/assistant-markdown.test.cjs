const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync('src/assistant-markdown.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports });
const { assistantDraftFromMarkdown } = moduleValue.exports;

test('Markdown prompt becomes a reviewable custom assistant draft', () => {
  const draft = assistantDraftFromMarkdown('Research notes.md', '# Research\n\nUse cited sources.');
  assert.equal(draft.name, 'Research notes');
  assert.equal(draft.systemPrompt, '# Research\n\nUse cited sources.');
  assert.equal(draft.category, 'Uncategorized');
  assert.equal(draft.realtimePrompt, '');
});

test('Markdown prompt import rejects unsupported or oversized files', () => {
  for (const [name, content] of [
    ['prompt.txt', 'Instructions'],
    ['.md', 'Instructions'],
    ['prompt.md', '   '],
    ['prompt.md', 'x'.repeat(20001)],
    ['prompt.md', 'abc\u0000def'],
  ]) {
    assert.throws(() => assistantDraftFromMarkdown(name, content));
  }
});
