const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

test('silence is an informational hint; missing permissions have one action to the existing exact pane', async () => {
  const hints = [],
    panes = [],
    errors = [];
  const { showListeningHint } = loadTsx('src/features/workspace/listening-hint.ts', {
    'src/format.ts': { errorMessage: (error) => error.message },
    sonner: { toast: { message: (message, options) => hints.push({ message, options }) } },
    'src/features/workspace/error-toast.ts': { showError: (message) => errors.push(message) },
  });
  const api = { openPrivacyPane: async (permission) => panes.push(permission) };
  showListeningHint(api);
  assert.equal(hints.length, 1);
  assert.equal(
    hints[0].message,
    'Nothing heard yet. LearnTranscriber writes down what it hears; ask again once people talk.',
  );
  assert.equal(hints[0].options.action, undefined);
  for (const [permission, label] of [
    ['microphone', 'Microphone'],
    ['screen', 'Screen & System Audio'],
    ['speech', 'Speech Recognition'],
  ]) {
    showListeningHint(api, permission);
    const hint = hints.at(-1);
    assert.ok(hint.message.includes(label));
    assert.equal(hint.options.action.label, 'Open System Settings');
    hint.options.action.onClick();
  }
  assert.deepEqual(panes, ['microphone', 'screen', 'speech']);
  assert.deepEqual(errors, []);
  showListeningHint(
    {
      openPrivacyPane: async () => {
        throw new Error('Could not open');
      },
    },
    'screen',
  );
  hints.at(-1).options.action.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, ['Could not open']);
});
