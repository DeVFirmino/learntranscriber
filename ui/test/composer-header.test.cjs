const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { ComposerHeader } = loadTsx('src/features/overlay/composer-header.tsx', {
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
});
test('expanded question removes the empty shortcut header entirely', () => {
  assert.equal(ComposerHeader({}), null);
});
test('compact question retains drag, minimize and close controls without an Enter hint', () => {
  let count = 0;
  const tree = ComposerHeader({ compact: true, onToggle: () => count++, onClose: () => count++ });
  assert.doesNotMatch(JSON.stringify(tree), /Enter|Return|ShortcutKeys/);
  for (const button of elements(tree, 'Button')) button.props.onClick();
  assert.equal(count, 2);
});
