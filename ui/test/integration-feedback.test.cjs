const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

test('a receiving surface presents permission feedback once with its action and never forwards it again', () => {
  const shown = [],
    routed = [];
  const { showIntegrationFeedback } = loadTsx('src/features/workspace/integration-feedback.ts', {
    sonner: { toast: { message: (message, options) => shown.push({ message, options }) } },
    'src/features/workspace/error-toast.ts': {
      showError: () => assert.fail('Expected a calm permission hint'),
      routeFeedback: (...args) => routed.push(args),
    },
  });
  const panes = [];
  showIntegrationFeedback(
    { openPrivacyPane: async (permission) => panes.push(permission) },
    { message: 'Native capture refused', notice: { permission: 'screen' } },
  );
  assert.equal(shown.length, 1);
  assert.ok(shown[0].message.includes('Screen & System Audio'));
  shown[0].options.action.onClick();
  assert.deepEqual(panes, ['screen']);
  assert.deepEqual(routed, []);
});
