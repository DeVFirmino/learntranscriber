const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { incomingOptions } = loadTs('src/settings/tabs/audio/incoming-options.ts');

const values = (options) => [...options.map((option) => option.value)];

test('incoming sources list the system routes, then the default and named inputs', () => {
  const { system, devices } = incomingOptions({
    choice: 'none',
    inputs: [{ deviceId: 'abc', label: 'BlackHole 2ch' }],
    tapSupported: true,
  });
  assert.deepEqual(values(system), ['none', 'system-audio', 'native-tap']);
  assert.deepEqual(values(devices), ['input:default', 'input:abc']);
  assert.equal(devices[1].device.label, 'BlackHole 2ch');
});

test('the process tap appears only where supported, unless it is already the chosen source', () => {
  assert.deepEqual(values(incomingOptions({ choice: 'none', inputs: [], tapSupported: false }).system), [
    'none',
    'system-audio',
  ]);
  assert.deepEqual(values(incomingOptions({ choice: 'native-tap', inputs: [], tapSupported: false }).system), [
    'none',
    'system-audio',
    'native-tap',
  ]);
});
