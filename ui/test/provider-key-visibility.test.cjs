const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
function harness(saved = false) {
  const hooks = [];
  let cursor = 0;
  const calls = [];
  const { KeyField } = loadTsx('src/settings/tabs/providers/key-field.tsx', {
    './key-field.css': {},
    react: {
      useState: (initial) => {
        const i = cursor++;
        if (!(i in hooks)) hooks[i] = initial;
        return [
          hooks[i],
          (value) => {
            hooks[i] = typeof value === 'function' ? value(hooks[i]) : value;
          },
        ];
      },
      useEffect: () => {},
    },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/settings/use-settings-t.ts': { useSettingsT: () => ({ st: (key) => key }) },
    'src/settings/settings-icon.tsx': { SettingsIcon: 'Icon' },
    'src/features/workspace/settings-save-feedback.ts': { saveWithFeedback: (task) => task() },
    'src/workspace.ts': {
      useWorkspace: () => ({
        state: { credentials: { openai: saved } },
        act: async (task) => task(),
        api: { saveKey: async (input) => calls.push(input) },
      }),
    },
  });
  return {
    calls,
    render: () => {
      cursor = 0;
      return KeyField({ provider: 'openai', placeholder: 'Example', note: 'Note' });
    },
  };
}

test('visibility changes only the typed key presentation; internal focus movement does not persist it', async () => {
  const h = harness();
  let view = h.render();
  elements(view, 'input')[0].props.onChange({ target: { value: 'fixture-only' } });
  view = h.render();
  assert.equal(elements(view, 'input')[0].props.type, 'password');
  const reveal = elements(view, 'button').find((button) => button.props['data-key-visibility']);
  reveal.props.onClick();
  view = h.render();
  assert.equal(elements(view, 'input')[0].props.type, 'text');
  const group = elements(view, 'div')[0];
  group.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} });
  assert.equal(h.calls.length, 0);
  group.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null });
  await new Promise(setImmediate);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].provider, 'openai');
  assert.equal(elements(h.render(), 'input')[0].props.type, 'password');
});

test('a saved credential remains masked and cannot be revealed or read back', () => {
  const h = harness(true);
  const view = h.render();
  assert.equal(elements(view, 'input')[0].props.type, 'password');
  const reveal = elements(view, 'button').find((button) => button.props['data-key-visibility']);
  assert.equal(reveal.props.disabled, true);
  assert.equal(h.calls.length, 0);
});
