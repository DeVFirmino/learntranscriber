const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { normalizeAssistant } = require('../src/main/domain/assistants/rules.cjs');
const { DEFAULTS, defaultsFor } = require('../src/main/domain/settings/defaults.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { text } = require('../src/main/domain/shared/text.cjs');

const fresh = { newId: () => 'new-id', savedKnowledgeFiles: () => undefined };
const base = { name: 'Research', prompt: 'Ground answers.' };

test('assistant input accepts limits and aliases exactly as before', () => {
  const accepted = [
    [{ ...base, name: 'n'.repeat(80) }, (a) => a.name.length === 80],
    [{ ...base, realtimePrompt: 'r'.repeat(20000) }, (a) => a.realtimePrompt.length === 20000],
    [{ ...base, context: 'c'.repeat(100000) }, (a) => a.context.length === 100000],
    [{ ...base, require_certainty: true }, (a) => a.requireCertainty],
    [{ ...base, category: '  ' }, (a) => a.category === 'Uncategorized'],
    [{ ...base, emailPrompt: null }, (a) => a.emailPrompt === ''],
  ];
  for (const [input, check] of accepted)
    assert.ok(check(normalizeAssistant(input, fresh)), JSON.stringify(input).slice(0, 80));
});

test('assistant input rejects the same edges with the same messages, in the same order', () => {
  const rejected = [
    [{ ...base, name: 'n'.repeat(81) }, /Enter valid text/],
    [{ ...base, prompt: '' }, /Enter valid text/],
    [{ ...base, realtimePrompt: 'r'.repeat(20001) }, /Invalid assistant field: realtimePrompt/],
    [{ ...base, context: 'c'.repeat(100001) }, /Invalid assistant field: context/],
    [{ ...base, knowledgeFiles: [{ name: 'a\nb', content: '', size: 0 }] }, /up to 20 readable knowledge files/],
    [
      { ...base, knowledgeFiles: [{ name: 'big', content: 'x'.repeat(200001), size: 1 }] },
      /up to 20 readable knowledge files/,
    ],
    [{ ...base, knowledgeFiles: 'bad', realtimePrompt: 5 }, /up to 20 readable knowledge files/],
  ];
  for (const [input, pattern] of rejected) assert.throws(() => normalizeAssistant(input, fresh), pattern);
});

test('omitted knowledge files keep the saved ones; an explicit list replaces them', () => {
  const saved = [{ name: 'notes.md', content: 'kept', size: 4 }];
  const options = { newId: () => 'unused', savedKnowledgeFiles: (id) => (id === 'a1' ? saved : undefined) };
  assert.deepEqual(normalizeAssistant({ ...base, id: 'a1' }, options).knowledgeFiles, saved);
  assert.deepEqual(normalizeAssistant({ ...base, id: 'a1', knowledgeFiles: [] }, options).knowledgeFiles, []);
  assert.equal(normalizeAssistant(base, options).id, 'unused');
});

test('settings validation still checks shortcuts through the shortcut parser', () => {
  assert.deepEqual(validateSettings({ shortcuts: '{}' }), { shortcuts: '{}' });
  assert.throws(() => validateSettings({ shortcuts: 'not json' }));
  assert.equal(text('  ok  ', 6), 'ok');
  assert.throws(() => text('  ok  ', 4));
});

test('the platform picks the incoming-audio default and the shortcut collisions', () => {
  assert.equal(defaultsFor('darwin'), DEFAULTS);
  assert.equal(defaultsFor('darwin').systemAudio, false);
  assert.equal(defaultsFor('win32').systemAudio, true);
  const shortcuts = JSON.stringify({
    ask: { accelerator: 'Command+K', enabled: true },
    capture: { accelerator: 'CommandOrControl+K', enabled: true },
  });
  assert.throws(() => validateSettings({ shortcuts }, 'darwin'), /cannot be duplicated/);
  assert.deepEqual(validateSettings({ shortcuts }, 'linux'), { shortcuts });
});

test('domain modules import nothing from SQLite, Electron, the filesystem or the host process', () => {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(join(__dirname, '../src/main/domain'));
  for (const file of files)
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /require\(['"](node:sqlite|electron|node:fs|node:child_process|node:os)|process\.(platform|env)/,
      file,
    );
});
