const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

test('saved ended summaries render their content and only offer generation, without draft editing', async () => {
  const calls = [];
  const session = { id: 'ended', ended_at: '2026-11-05', summary: 'Saved overview', entries: [] };
  const { SummaryEditor } = loadTsx('src/components/summary-editor.tsx', {
    'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
    'src/components/session-summary.tsx': { SessionSummary: 'Summary' },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/workspace.ts': {
      useWorkspace: () => ({
        session,
        requestId: null,
        api: {},
        act: async (work) => work(),
        runGeneration: async (mode) => calls.push(mode),
      }),
    },
  });
  const tree = SummaryEditor();
  assert.equal(elements(tree, 'Summary')[0].props.content, 'Saved overview');
  assert.equal(elements(tree, 'textarea').length, 0);
  const buttons = elements(tree, 'Button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.disabled, false);
  await buttons[0].props.onClick();
  assert.deepEqual(calls, ['summary']);
});
