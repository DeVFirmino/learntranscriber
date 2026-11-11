const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

const mocks = {
  'src/settings/use-settings-t.ts': { useSettingsT: () => ({ st: (key) => key }) },
  'src/settings/controls.tsx': { Toggle: 'Toggle' },
  'src/settings/tabs/shortcuts/shortcut-recorder.tsx': { ShortcutRecorder: 'Recorder' },
};

test('compact shortcut rows preserve key recording, disabled state, custom reset and enable actions', () => {
  const { ShortcutRow } = loadTsx('src/settings/tabs/shortcuts/shortcut-row.tsx', mocks);
  const calls = [];
  const row = ShortcutRow({
    item: { accelerator: 'Command+J', defaultAccelerator: 'Command+D', enabled: false, defaultEnabled: true },
    label: 'Ask',
    onRecord: (value) => {
      calls.push(['record', value]);
      return false;
    },
    onReset: () => calls.push(['reset']),
    onEnabled: (value) => calls.push(['enabled', value]),
  });
  const recorder = elements(row, 'Recorder')[0];
  assert.equal(recorder.props.value, 'Command+J');
  assert.equal(recorder.props.disabled, true);
  assert.equal(recorder.props.onRecord('Command+K'), false);
  elements(row, 'button')[0].props.onClick();
  const toggle = elements(row, 'Toggle')[0];
  assert.equal(toggle.props.checked, false);
  toggle.props.onChange(true);
  assert.deepEqual(calls, [['record', 'Command+K'], ['reset'], ['enabled', true]]);
  const content = JSON.stringify(row);
  assert.match(content, /settings.shortcuts.customBadge/);
  assert.match(content, /settings.shortcuts.disabledBadge/);
});
