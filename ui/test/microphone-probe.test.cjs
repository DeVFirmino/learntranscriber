const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { createMicrophoneProbe } = loadTs('src/audio/microphone-probe.ts');
function fixture(open) {
  const levels = [],
    calls = [];
  let read;
  const node = { connect() {} };
  const context = {
    resume: async () => {},
    close: async () => calls.push('close'),
    createAnalyser: () => ({ ...node, getFloatTimeDomainData: (a) => a.fill(0.1) }),
    createGain: () => ({ ...node, gain: {} }),
    createMediaStreamSource: () => node,
    destination: {},
  };
  const probe = createMicrophoneProbe({
    open: open || (async () => ({ getTracks: () => [{ stop: () => calls.push('stop') }] })),
    createContext: () => context,
    every: (fn) => {
      read = fn;
      return 1;
    },
    cancel: () => calls.push('cancel'),
    changed: (l) => levels.push(l),
  });
  return { probe, levels, calls, read: () => read() };
}
test('microphone test reports measured levels and releases the track, graph and timer', async () => {
  const h = fixture();
  assert.equal(await h.probe.start('default'), true);
  h.read();
  assert.ok(h.levels.at(-1) > 0);
  await h.probe.stop();
  assert.deepEqual(h.calls, ['cancel', 'stop', 'close']);
  assert.equal(h.levels.at(-1), 0);
});
test('permission or device failure is reported and a cancelled late stream is released', async () => {
  const failed = fixture(async () => {
    throw new Error('Permission denied');
  });
  await assert.rejects(failed.probe.start('x'), /Permission/);
  let resolve;
  const late = fixture(() => new Promise((r) => (resolve = r)));
  const start = late.probe.start('x');
  await new Promise(setImmediate);
  await late.probe.stop();
  resolve({ getTracks: () => [{ stop: () => late.calls.push('late-stop') }] });
  assert.equal(await start, false);
  assert.ok(late.calls.includes('late-stop'));
});
