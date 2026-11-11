const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');
function harness() {
  const events = [];
  const toast = Object.fromEntries(
    ['loading', 'success', 'dismiss'].map((method) => [method, (...args) => events.push({ method, args })]),
  );
  const { saveWithFeedback } = loadTsx('src/features/workspace/settings-save-feedback.ts', {
    sonner: { toast },
    'src/i18n.ts': { documentT: (key) => key },
  });
  return { saveWithFeedback, events };
}

test('save success is shown only after the bridge confirms and replaces the pending toast', async () => {
  const { saveWithFeedback, events } = harness();
  let confirm;
  const pending = saveWithFeedback(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  assert.deepEqual(
    events.map((event) => event.method),
    ['loading'],
  );
  confirm('confirmed');
  assert.equal(await pending, 'confirmed');
  assert.deepEqual(
    events.map((event) => event.method),
    ['loading', 'success'],
  );
  assert.equal(events[0].args[1].id, events[1].args[1].id);
});

test('failed save removes the pending toast and preserves the error for the existing reporter', async () => {
  const { saveWithFeedback, events } = harness();
  const error = new Error('Rejected save');
  await assert.rejects(
    saveWithFeedback(async () => {
      throw error;
    }),
    (cause) => cause === error,
  );
  assert.deepEqual(
    events.map((event) => event.method),
    ['loading', 'dismiss'],
  );
});
