// The microphone list leaves out the system's own entries and goes by name; the incoming source shows its icon.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { microphoneInputs, incomingIcon } = loadTs('src/settings/tabs/audio/audio-sources.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the microphones a user picks leave out the default and communications entries and go by name', () => {
  const devices = [
    { deviceId: 'default', label: 'Default - MacBook Microphone' },
    { deviceId: 'b', label: 'USB Microphone' },
    { deviceId: 'communications', label: 'Communications' },
    { deviceId: 'a', label: 'AirPods' },
    { deviceId: 'c', label: '' },
  ];
  assert.deepEqual(plain(microphoneInputs(devices).map((device) => device.deviceId)), ['c', 'a', 'b']);
  assert.deepEqual(plain(microphoneInputs(null)), []);
});

test('each incoming source has its icon', () => {
  assert.equal(incomingIcon('none'), 'mic_off');
  assert.equal(incomingIcon('system-audio'), 'desktop_windows');
  assert.equal(incomingIcon('native-tap'), 'hearing');
  assert.equal(incomingIcon('input:usb'), 'mic');
});
