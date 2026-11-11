const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const base = {
  'src/components/ui/preference-field.tsx': { PreferenceField: 'PreferenceField' },
  'src/components/ui/choice-tile.tsx': { ChoiceTile: 'ChoiceTile' },
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/settings/use-settings-t.ts': { useSettingsT: () => ({ st: (key) => key }) },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
  'src/settings/settings-icon.tsx': { SettingsIcon: 'SettingsIcon' },
  '../../shared-choice-layout.css': {},
  'radix-ui': { RadioGroup: { Root: 'RadioGroup' } },
};

test('display choices preserve selected ID, full display labels and refresh action', () => {
  const calls = [];
  const { DisplayPane } = loadTsx('src/settings/tabs/audio/display-pane.tsx', base);
  const view = DisplayPane({
    displays: [
      { id: 1, label: 'Built-in display' },
      { id: 22, label: 'External display' },
    ],
    displayId: '22',
    onChoose: (id) => calls.push(id),
    onRefresh: () => calls.push('refresh'),
  });
  const group = elements(view, 'RadioGroup')[0];
  assert.equal(group.props.value, '22');
  assert.equal(group.props['aria-labelledby'], 'capture-display-label');
  const choices = elements(view, 'ChoiceTile');
  assert.deepEqual(
    choices.map((choice) => choice.props.value),
    ['1', '22'],
  );
  assert.equal(choices[1].props.label, 'External display');
  group.props.onValueChange('1');
  elements(view, 'Button')[0].props.onClick();
  assert.deepEqual(calls, ['1', 'refresh']);
});

test('local performance choices retain exact preset settings and busy/custom behavior', () => {
  const calls = [];
  const { LlmPreset } = loadTsx('src/settings/tabs/local/llm-preset.tsx', base);
  const { PRESETS } = require('./helpers/load-ts.cjs').loadTs('src/settings/local-presets.ts');
  const launch = { busy: false, starting: false, preset: 'balanced', launch: (patch) => calls.push(patch) };
  const render = () =>
    LlmPreset({ launch, autoTuned: false, recommended: 'balanced', onCustom: () => calls.push('custom') });
  const group = elements(render(), 'RadioGroup')[0];
  group.props.onValueChange('safe');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), JSON.parse(JSON.stringify({ settings: PRESETS.safe })));
  group.props.onValueChange('custom');
  assert.equal(calls[1], 'custom');
  launch.busy = true;
  assert.equal(elements(render(), 'RadioGroup')[0].props.disabled, true);
  launch.busy = false;
  launch.starting = true;
  assert.equal(elements(render(), 'RadioGroup')[0].props.disabled, true);
  launch.preset = 'custom';
  const custom = elements(render(), 'ChoiceTile').find((choice) => choice.props.value === 'custom');
  assert.equal(custom.props.disabled, true);
});

test('notes folder actions retain native chooser and default-location reset', async () => {
  const calls = [];
  const ws = {
    act: async (task) => task(),
    api: {
      chooseSessionNotesFolder: async () => {
        calls.push('choose');
        return '/preview/notes';
      },
      settings: async (patch) => calls.push(patch),
    },
  };
  const { SessionNotesCard } = loadTsx('src/settings/tabs/features/session-notes-card.tsx', {
    ...base,
    react: { useState: () => ['', () => {}], useEffect: () => {} },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/components/brand-icon.ts': { BrandTranscript: 'BrandTranscript' },
  });
  const buttons = elements(SessionNotesCard({ folder: '/preview/notes' }), 'Button');
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  await new Promise(setImmediate);
  assert.equal(calls[0], 'choose');
  assert.equal(calls[1].sessionNotesFolder, '');
  assert.equal(elements(SessionNotesCard({ folder: '' }), 'Button').length, 1);
});
