const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { LlmPerformance } = loadTsx('src/settings/tabs/local/llm-performance.tsx', {
  'radix-ui': { Collapsible: { Root: 'Disclosure', Trigger: 'Trigger', Content: 'Content' } },
  '../../advanced-preferences.css': {},
  'src/settings/tabs/local/llm-preset.tsx': { LlmPreset: 'Preset' },
  'src/settings/tabs/local/llm-tuning-panel.tsx': { LlmTuningPanel: 'Tuning' },
  'src/settings/settings-icon.tsx': { SettingsIcon: 'Icon' },
  'src/settings/use-settings-t.ts': { useSettingsT: () => ({ st: (key) => key }) },
  'src/settings/local-presets.ts': { recommendedPreset: () => 'safe' },
});

test('technical launch values appear only after opening advanced settings', () => {
  let expanded = false;
  const props = {
    launch: { local: {}, shown: { localContextSize: 4096 }, saved: null, running: false },
    draft: {},
    onDraft: () => {},
    onTuning: (update) => {
      expanded = update(expanded);
    },
  };
  const basic = LlmPerformance({ ...props, tuning: expanded });
  assert.equal(elements(basic, 'Preset').length, 1);
  assert.equal(elements(basic, 'Tuning').length, 0);
  assert.ok(!JSON.stringify(basic).includes('launchConfigTitle'));
  const action = elements(basic, 'button')[0];
  assert.equal(action.props['aria-expanded'], false);
  elements(basic, 'Disclosure')[0].props.onOpenChange(true);
  const advanced = LlmPerformance({ ...props, tuning: expanded });
  assert.ok(JSON.stringify(advanced).includes('launchConfigTitle'));
  assert.equal(elements(advanced, 'Tuning').length, 1);
  assert.equal(elements(advanced, 'button')[0].props['aria-expanded'], true);
  assert.ok(elements(advanced, 'Content').some((node) => node.props.id === action.props['aria-controls']));
  elements(advanced, 'Disclosure')[0].props.onOpenChange(false);
  assert.equal(expanded, false);
});
