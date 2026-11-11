const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { shortcutCardState } = loadTs('src/features/shortcut-card-state.ts');

test('shortcut cards preserve custom badges and reset while disabled takes visual precedence', () => {
  const defaults = { accelerator: 'Control+K', defaultAccelerator: 'Control+K', enabled: true, defaultEnabled: true };
  const cases = [
    [defaults, { state: 'default', custom: false, canReset: false }],
    [
      { ...defaults, accelerator: 'Control+J' },
      { state: 'custom', custom: true, canReset: true },
    ],
    [
      { ...defaults, enabled: false },
      { state: 'disabled', custom: false, canReset: true },
    ],
    [
      { ...defaults, enabled: false, accelerator: 'Control+J' },
      { state: 'disabled', custom: true, canReset: true },
    ],
    [
      { ...defaults, enabled: false, defaultEnabled: false },
      { state: 'disabled', custom: false, canReset: false },
    ],
    [
      { ...defaults, defaultEnabled: false },
      { state: 'default', custom: false, canReset: true },
    ],
  ];
  for (const [input, expected] of cases) assert.deepEqual({ ...shortcutCardState(input) }, expected);
});
