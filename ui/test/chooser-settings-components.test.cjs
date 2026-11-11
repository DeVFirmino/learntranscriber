const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const shell = new Proxy({}, { get: (_target, name) => name });
const base = {
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
  'src/components/ui/card.tsx': shell,
  'src/components/ui/badge.tsx': { Badge: 'Badge' },
  'src/components/ui/tooltip.tsx': shell,
  'src/settings/settings-icon.tsx': { SettingsIcon: 'SettingsIcon' },
  'src/settings/feature-art.tsx': { FeatureArt: 'FeatureArt' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
};

test('built-in choices expose their checked state and save only the reviewed selection', async () => {
  const calls = [];
  const ws = {
    state: {
      settings: { assistantsChosen: true },
      assistants: [{ id: 'math' }],
      builtInAssistants: [{ id: 'math', name: 'Math', category: 'Education' }],
    },
    act: async (task) => task(),
    api: { chooseBuiltInAssistants: async (ids) => calls.push([...ids]) },
  };
  const mocks = {
    ...base,
    react: { ...require('react'), useState: (initial) => [initial(), () => {}] },
    'src/workspace.ts': { useWorkspace: () => ws },
  };
  const { BuiltInPicker } = loadTsx('src/features/assistants/built-in-picker.tsx', mocks);
  const chooser = BuiltInPicker({ onDone: () => calls.push('done') });
  assert.equal(elements(chooser, 'button')[0].props['aria-checked'], true);
  assert.deepEqual(calls, []);
  elements(chooser, 'Button')[1].props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(calls, [['math'], 'done']);
});

test('the nav hide action uses the native hide port', async () => {
  const calls = [];
  const ws = { act: async (task) => task(), api: { hide: async () => calls.push('hide') } };
  const { HideButton } = loadTsx('src/features/shell/hide-button.tsx', {
    ...base,
    'src/workspace.ts': { useWorkspace: () => ws },
  });
  elements(HideButton(), 'Button')[0].props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['hide']);
});

test('feature cards keep a permission action and grant status in separate slots', () => {
  const { FeatureCard } = loadTsx('src/settings/feature-card.tsx', base);
  const feature = FeatureCard({
    art: 'Art',
    icon: 'mic',
    title: 'Microphone',
    control: 'Allowed',
    description: 'Capture speech',
    children: 'Request access',
  });
  const text = JSON.stringify(feature);
  for (const expected of ['Art', 'Microphone', 'Allowed', 'Capture speech', 'Request access'])
    assert.ok(text.includes(expected));
  const { PermissionRow } = loadTsx('src/settings/tabs/permissions/permission-row.tsx', base);
  let requested = 0;
  for (const granted of [true, false]) {
    const card = PermissionRow({
      icon: 'mic',
      granted,
      label: 'Microphone',
      description: 'Capture speech',
      actionLabel: 'Open Settings',
      actionDisabled: false,
      onClick: () => requested++,
    });
    assert.equal(elements(card, 'Badge')[0].props.children, granted ? 'permissions.granted' : 'permissions.notGranted');
    assert.equal(elements(card, 'Button')[0].props.disabled, false);
    elements(card, 'Button')[0].props.onClick();
  }
  assert.equal(requested, 2);
});
