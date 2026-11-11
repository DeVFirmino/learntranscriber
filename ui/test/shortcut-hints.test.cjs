const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { shortcutHints } = loadTs('src/features/overlay/shortcut-hints.ts');
const { nextHold } = loadTs('src/features/overlay/held-command.ts');

const definitions = [
  ['record', 'CommandOrControl+D'],
  ['capture', 'CommandOrControl+E'],
  ['ask', 'CommandOrControl+Return'],
  ['mic', 'CommandOrControl+Shift+D'],
  ['hide', 'CommandOrControl+B'],
  ['overlay', 'CommandOrControl+M'],
  ['previousResponse', 'CommandOrControl+Alt+Up'],
  ['nextResponse', 'CommandOrControl+Alt+Down'],
].map(([id, accelerator]) => ({ id, accelerator, enabled: true }));
const ids = (hints) => Array.from(hints, (hint) => hint.id);

test('the sheet lists what fits the state, with the keys the user actually has', () => {
  const idle = shortcutHints(definitions, { listening: false, answers: false });
  assert.deepEqual(ids(idle.now), ['record', 'capture', 'ask']);
  assert.deepEqual(ids(idle.windows), ['hide', 'overlay']);
  assert.equal(idle.answers.length, 0);
  const live = shortcutHints(definitions, { listening: true, answers: true });
  assert.deepEqual(ids(live.now), ['record', 'capture', 'mic']);
  assert.deepEqual(ids(live.answers), ['previousResponse', 'nextResponse']);
  const remapped = definitions.map((item) =>
    item.id === 'capture' ? { ...item, accelerator: 'CommandOrControl+Shift+S' } : item,
  );
  assert.equal(
    shortcutHints(remapped, { listening: false, answers: false }).now[1].accelerator,
    'CommandOrControl+Shift+S',
  );
});

test('disabled or unbound shortcuts are left out', () => {
  const partial = definitions.map((item) =>
    item.id === 'hide' ? { ...item, enabled: false } : item.id === 'ask' ? { ...item, accelerator: '' } : item,
  );
  const hints = shortcutHints(partial, { listening: false, answers: false });
  assert.deepEqual(ids(hints.now), ['record', 'capture']);
  assert.deepEqual(ids(hints.windows), ['overlay']);
});

test('holding Command alone shows the sheet; using a shortcut or releasing hides it', () => {
  const run = (events) => events.reduce(nextHold, 'idle');
  assert.equal(run([{ type: 'down', key: 'Meta' }]), 'waiting');
  assert.equal(run([{ type: 'down', key: 'Meta' }, { type: 'elapsed' }]), 'shown');
  assert.equal(run([{ type: 'down', key: 'Control' }, { type: 'elapsed' }]), 'shown');
  assert.equal(run([{ type: 'down', key: 'Meta' }, { type: 'down', key: 'd' }, { type: 'elapsed' }]), 'used');
  assert.equal(run([{ type: 'down', key: 'Meta' }, { type: 'elapsed' }, { type: 'up', key: 'Meta' }]), 'idle');
  assert.equal(run([{ type: 'down', key: 'Meta' }, { type: 'elapsed' }, { type: 'blur' }]), 'idle');
  assert.equal(run([{ type: 'down', key: 'a' }, { type: 'elapsed' }]), 'idle');
});
