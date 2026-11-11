const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
test('native opacity range persists lower keyboard/pointer values without waiting for a drag commit', async () => {
  const saved = [];
  const { OverlayOpacity } = loadTsx('src/components/overlay-opacity.tsx', {
    './overlay-opacity.css': {},
    react: { useState: () => [null, () => {}], useRef: (v) => ({ current: v }) },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/workspace.ts': {
      useWorkspace: () => ({ act: async (fn) => fn(), api: { settings: async (patch) => saved.push(patch) } }),
    },
  });
  const tree = OverlayOpacity({ value: 100 });
  const range = elements(tree, 'input')[0];
  assert.equal(range.props.type, 'range');
  assert.equal(range.props.min, 25);
  assert.equal(range.props.max, 100);
  const original = global.document;
  global.document = { querySelectorAll: () => [] };
  try {
    range.props.onChange({ currentTarget: { value: '44' } });
    await new Promise(setImmediate);
    assert.deepEqual(JSON.parse(JSON.stringify(saved)), [{ overlayOpacity: 0.44 }]);
  } finally {
    global.document = original;
  }
});
