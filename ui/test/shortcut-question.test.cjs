const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');
test('an Ask action received by the workspace opens the floating question without navigating or capturing', async () => {
  const calls = [];
  const { useShortcutActions } = loadTsx('src/features/workspace/use-shortcut-actions.ts', {
    react: { useLayoutEffect: (effect) => effect(), useRef: (value) => ({ current: value }) },
  });
  const dispatch = useShortcutActions({
    overlay: () => false,
    openQuestion: async (draft) => calls.push(['question', draft]),
    captureScreen: () => assert.fail('Unexpected screen capture'),
  });
  await dispatch('ask');
  assert.deepEqual(calls, [['question', '']]);
});
