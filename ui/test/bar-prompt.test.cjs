const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
function harness(text = 'Explain this', failure = false, { ready = true, busy = false, freshReady = ready } = {}) {
  const calls = [],
    values = [];
  const state = {
    activeSessionId: 'live',
    settings: { provider: 'openai', model: 'chosen', customBaseUrl: '' },
    credentials: { openai: ready },
    chatgpt: { accounts: [], activeId: null },
    localModels: { models: [], binaries: {} },
  };
  const { BarPrompt } = loadTsx('src/features/bar-prompt.tsx', {
    react: {
      useRef: (value) => ({ current: value }),
      useState: () => [false, (value) => values.push(typeof value === 'function' ? value('') : value)],
    },
    'src/components/ui/send-button.tsx': { SendButton: 'SendButton' },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/workspace.ts': {
      useWorkspace: () => ({
        state,
        requestId: busy ? 'in-flight' : null,
        act: async (work) => {
          try {
            await work();
          } catch {}
        },
        api: {
          state: async () => ({ ...state, credentials: { openai: freshReady } }),
          showOverlay: async (value) => {
            calls.push(['showOverlay', value]);
            if (failure) throw new Error('Unavailable');
          },
          capture: () => assert.fail('Enter must never capture the screen'),
        },
        runGeneration: async (...args) => calls.push(['generate', ...args]),
      }),
    },
  });
  const form = BarPrompt({
    value: text,
    onChange: (value) => values.push(typeof value === 'function' ? value('') : value),
  });
  return { form, calls, values };
}
test('Enter in the bar shows Session and submits the typed question directly without capture', async () => {
  const h = harness('  Explain this  ');
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, [
    ['showOverlay', true],
    ['generate', 'chat', 'Explain this'],
  ]);
  assert.equal(elements(h.form, 'input')[0].props.value, '  Explain this  ');
});
test('failed question opening restores the text for retry', async () => {
  const h = harness('Keep this draft', true);
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.ok(h.values.includes('Keep this draft'));
});
test('blank bar prompts cannot submit or open a question', async () => {
  const h = harness(' ');
  assert.equal(elements(h.form, 'SendButton')[0].props.disabled, true);
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, []);
});

test('bar readiness blocks Enter and the send button without changing the draft', async () => {
  const h = harness('Keep my question', false, { ready: false });
  assert.equal(elements(h.form, 'SendButton')[0].props.disabled, true);
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.values, []);
});

test('bar preserves its draft if readiness disappears while opening the panel', async () => {
  const h = harness('Keep my question', false, { freshReady: false });
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['showOverlay', true]]);
  assert.ok(h.values.includes('Keep my question'));
});

test('bar keeps the in-flight guard even with a configured provider', async () => {
  const h = harness('Wait for this', false, { busy: true });
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.values, []);
});

test('rapid repeated submission cannot open two panels or send the question twice', async () => {
  const h = harness('One question');
  h.form.props.onSubmit({ preventDefault() {} });
  h.form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.calls, [
    ['showOverlay', true],
    ['generate', 'chat', 'One question'],
  ]);
});
