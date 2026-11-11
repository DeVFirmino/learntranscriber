const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
test('the microphone meter uses live levels while recording and never starts a preview automatically', () => {
  let starts = 0;
  const { MicrophoneTest } = loadTsx('src/settings/tabs/audio/microphone-test.tsx', {
    react: { useState: (value) => [typeof value === 'function' ? value() : value, () => {}], useEffect: () => {} },
    'src/audio/microphone-probe.ts': {
      createMicrophoneProbe: () => ({
        start: async () => {
          starts++;
          return true;
        },
        stop: async () => {},
      }),
    },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/format.ts': { errorMessage: String },
  });
  const tree = MicrophoneTest({ deviceId: 'default', recording: true, liveLevel: 0.6 });
  assert.equal(elements(tree, 'div').find((v) => v.props.role === 'meter').props['aria-valuenow'], 60);
  assert.equal(elements(tree, 'Button')[0].props.disabled, true);
  assert.equal(starts, 0);
});
