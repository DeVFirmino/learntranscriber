// FP08-S02 fixtures: the shared incoming-audio capture under leases, its routes and the driver status. A fake capture
// stands in for the helper; nothing records audio.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createOutputLeases } = require('../src/main/application/audio/output-leases.cjs');
const { createSystemAudioCapture } = require('../src/main/application/audio/system-audio.cjs');
const { driverStatus, processTapAvailable } = require('../src/main/application/audio/driver-status.cjs');
const { registerAudio } = require('../src/main/interface/ipc/audio.cjs');
const { SystemAudio } = require('../src/main/infrastructure/native/system-audio.cjs');

function fakeCapture({ route = 'native', delay = 0, fail = null } = {}) {
  const log = [];
  return {
    log,
    async start(sessionId) {
      log.push(`start:${sessionId}`);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (fail) throw new Error(fail);
      return { route };
    },
    async stop() {
      log.push('stop');
    },
  };
}
const states = () => {
  const list = [];
  return {
    list,
    onState: (state) =>
      list.push(`${state.state}${state.transient ? ':transient' : ''}${state.unexpected ? ':unexpected' : ''}`),
  };
};

test('the capture stays alive while any lease is held and stops with the last one', async () => {
  const capture = fakeCapture(),
    events = states();
  const leases = createOutputLeases({ capture, onState: events.onState });
  assert.deepEqual(await leases.acquire(1, 'recording', 's1'), { sessionId: 's1', route: 'native', shared: false });
  assert.deepEqual(await leases.acquire(2, 'level', 's1'), {
    sessionId: 's1',
    route: 'native',
    alreadyActive: true,
    shared: true,
  });
  assert.deepEqual(await leases.release(1, 'recording'), { shared: true, remainingLeases: 1 });
  assert.equal(leases.status().active, true);
  assert.deepEqual(await leases.release(2, 'level'), { stopped: true });
  assert.deepEqual(await leases.release(2, 'level'), { alreadyReleased: true });
  assert.deepEqual(capture.log, ['start:s1', 'stop']);
  assert.deepEqual(events.list, ['active', 'stopped']);
  assert.deepEqual(leases.status(), { active: false, leases: 0 });
});

test('concurrent acquires share one start', async () => {
  const capture = fakeCapture({ delay: 20 });
  const leases = createOutputLeases({ capture });
  const [a, b] = await Promise.all([leases.acquire(1, 'a', 's1'), leases.acquire(1, 'b', 's1')]);
  assert.equal(a.route, 'native');
  assert.equal(b.alreadyActive, true);
  assert.deepEqual(capture.log, ['start:s1']);
});

test('a lease for another session restarts the capture for it and drops the old session leases', async () => {
  const capture = fakeCapture(),
    events = states();
  const leases = createOutputLeases({ capture, onState: events.onState });
  await leases.acquire(1, 'recording', 's1');
  await leases.acquire(2, 'level', 's1');
  const switched = await leases.acquire(1, 'recording-2', 's2');
  assert.equal(switched.sessionId, 's2');
  assert.deepEqual(capture.log, ['start:s1', 'stop', 'start:s2']);
  assert.deepEqual(events.list, ['active', 'stopped:transient', 'active']);
  assert.equal(leases.status().leases, 1);
});

test('an unexpected stop keeps the leases, and the next acquire starts again', async () => {
  const capture = fakeCapture(),
    events = states();
  const leases = createOutputLeases({ capture, onState: events.onState });
  await leases.acquire(1, 'recording', 's1');
  leases.ended('The incoming audio helper stopped.');
  assert.deepEqual(leases.status(), { active: false, leases: 1 });
  assert.equal((await leases.acquire(1, 'recording', 's1')).route, 'native');
  assert.deepEqual(capture.log, ['start:s1', 'start:s1']);
  assert.deepEqual(events.list, ['active', 'stopped:unexpected', 'active']);
});

test('a default-output change during capture is published as a transient state and leaves the leases untouched', async () => {
  const capture = fakeCapture(),
    published = [],
    leases = createOutputLeases({ capture, onState: (state) => published.push(state) });
  await leases.acquire(1, 'recording', 'session');
  leases.route({ event: 'reconnecting', reason: 'default output changed' });
  leases.route({ event: 'device-changed', deviceId: 'usb-1', deviceName: 'Desk Speakers' });
  assert.deepEqual(
    published.map(({ state, reason, deviceId, deviceName }) => [state, reason, deviceId, deviceName]),
    [
      ['active', undefined, undefined, undefined],
      ['reconnecting', 'default output changed', undefined, undefined],
      ['active', undefined, 'usb-1', 'Desk Speakers'],
    ],
  );
  assert.equal(leases.status().active, true);
  assert.equal(leases.status().leases, 1);
  assert.deepEqual(capture.log, ['start:session']);
});

test('a route event with nothing running is a no-op', () => {
  const published = [],
    leases = createOutputLeases({ capture: fakeCapture(), onState: (state) => published.push(state) });
  leases.route({ event: 'reconnecting', reason: 'default output changed' });
  assert.deepEqual(published, []);
  assert.equal(leases.status().active, false);
});

test('repeated capture cycles leave nothing running', async () => {
  const capture = fakeCapture();
  const leases = createOutputLeases({ capture });
  for (let round = 0; round < 3; round++) {
    await leases.acquire(1, `recording-${round}`, 's1');
    await leases.release(1, `recording-${round}`);
  }
  assert.deepEqual(capture.log, ['start:s1', 'stop', 'start:s1', 'stop', 'start:s1', 'stop']);
  assert.deepEqual(leases.status(), { active: false, leases: 0 });
});

test('a window that goes away releases only its own leases', async () => {
  const capture = fakeCapture();
  const leases = createOutputLeases({ capture });
  await leases.acquire(1, 'recording', 's1');
  await leases.acquire(2, 'probe', 's1');
  assert.deepEqual(await leases.releaseOwner(2), { released: 1 });
  assert.equal(leases.status().active, true);
  assert.deepEqual(await leases.releaseOwner(1), { released: 1 });
  assert.deepEqual(capture.log, ['start:s1', 'stop']);
});

test('abandoning the last lease keeps the capture for a hand-off', async () => {
  const capture = fakeCapture();
  const leases = createOutputLeases({ capture });
  await leases.acquire(1, 'old', 's1');
  assert.deepEqual(await leases.release(1, 'old', { stopIfLast: false }), { shared: false, remainingLeases: 0 });
  assert.equal(leases.status().active, true);
  assert.equal((await leases.acquire(1, 'new', 's1')).alreadyActive, true);
  assert.deepEqual(capture.log, ['start:s1']);
});

test('a start that finishes after the session ended is undone and reported as cancelled', async () => {
  const capture = fakeCapture({ delay: 20 });
  const leases = createOutputLeases({ capture });
  const pending = leases.acquire(1, 'recording', 's1');
  await new Promise((resolve) => setTimeout(resolve, 5));
  await leases.stop();
  assert.deepEqual(await pending, { cancelled: true, error: 'Incoming audio start was cancelled.', shared: false });
  assert.deepEqual(capture.log, ['start:s1', 'stop', 'stop']);
  assert.deepEqual(leases.status(), { active: false, leases: 0 });
});

test('a failed start keeps no lease, and invalid leases are refused', async () => {
  const leases = createOutputLeases({ capture: fakeCapture({ fail: 'Permission denied' }) });
  await assert.rejects(leases.acquire(1, 'recording', 's1'), /Permission denied/);
  assert.deepEqual(leases.status(), { active: false, leases: 0 });
  await assert.rejects(leases.acquire(1, '', 's1'), /valid audio lease/);
  await assert.rejects(leases.acquire('1', 'x', 's1'), /valid audio lease/);
});

test('an explicit route switch restarts the same session under the same leases', async () => {
  let route = 'native';
  const capture = fakeCapture();
  capture.start = async (sessionId) => {
    capture.log.push(`start:${sessionId}:${route}`);
    return { route };
  };
  const leases = createOutputLeases({ capture });
  assert.deepEqual(await leases.restart(), { restarted: false });
  await leases.acquire(1, 'recording', 's1');
  route = 'process-tap';
  assert.deepEqual(await leases.restart(), { sessionId: 's1', route: 'process-tap', restarted: true });
  assert.deepEqual(capture.log, ['start:s1:native', 'stop', 'start:s1:process-tap']);
  assert.equal(leases.status().leases, 1);
});

test('the process tap route falls back to ScreenCaptureKit and window routes stay in the window', async () => {
  const calls = [];
  let tapFails = true,
    source = 'process-tap';
  const capture = createSystemAudioCapture({
    active: { id: () => 's1' },
    settings: () => ({ systemAudio: true, systemAudioSource: source, displayId: '', liveTranscription: false }),
    systemAudio: {
      start: async (...args) => {
        calls.push(args);
        if (args[3]?.processTap && tapFails) throw new Error('The process tap source requires macOS 14.2 or later.');
      },
    },
  });
  assert.deepEqual(await capture.start('s1'), {
    route: 'native',
    fellBack: true,
    reason: 'The process tap source requires macOS 14.2 or later.',
  });
  tapFails = false;
  assert.deepEqual(await capture.start('s1'), { route: 'process-tap' });
  assert.deepEqual(calls, [
    ['s1', '', false, { processTap: true }],
    ['s1', '', false],
    ['s1', '', false, { processTap: true }],
  ]);
  for (source of ['electron', 'input-device']) await assert.rejects(capture.start('s1'), /captured by the window/);
});

test('leases taken over IPC end with their window', async () => {
  const handlers = new Map();
  const capture = fakeCapture();
  const leases = createOutputLeases({ capture });
  registerAudio((channel, handler) => handlers.set(channel, handler), {
    systemAudio: { status: async () => ({}), devices: async () => ({ devices: [], defaultOutputUID: null }) },
    leases,
    driver: (devices) => driverStatus({ platform: 'darwin', systemVersion: '26.6', devices }),
    live: {},
    segments: {},
    speech: {},
  });
  for (const event of ['destroyed', 'render-process-gone', 'navigation']) {
    const sender = new EventEmitter();
    sender.id = 7;
    await handlers.get('audio:output-acquire')({ sender }, 'recording', 's1');
    if (event === 'navigation') sender.emit('did-start-navigation', {}, 'file:///other', false, true);
    else sender.emit(event);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(leases.status(), { active: false, leases: 0 }, event);
  }
  // A same-document navigation keeps the lease.
  const sender = new EventEmitter();
  sender.id = 8;
  await handlers.get('audio:output-acquire')({ sender }, 'recording', 's1');
  sender.emit('did-start-navigation', {}, 'file:///same#hash', true, true);
  assert.equal(leases.status().leases, 1);
  await assert.rejects(
    async () => handlers.get('audio:output-acquire')({ sender }, 'recording', ''),
    /Choose a session/,
  );
  const status = await handlers.get('audio:output-status')({ sender });
  assert.equal(status.active, true);
  assert.equal(status.driver.required, false);
});

test('the driver is never required or installed here, and the tap needs macOS 14.2', () => {
  for (const [version, expected] of [
    ['14.1', false],
    ['14.2', true],
    ['15.0', true],
    ['26.6.2', true],
    ['', false],
  ])
    assert.equal(processTapAvailable('darwin', version), expected, version);
  assert.equal(processTapAvailable('win32', '26.0'), false);
  const status = driverStatus({
    platform: 'darwin',
    systemVersion: '14.1',
    devices: [
      { uid: 'speakers', name: 'MacBook Pro Speakers', isDefault: true, hasInput: false },
      { uid: 'loop', name: 'BlackHole 2ch', isDefault: false, hasInput: true },
    ],
  });
  assert.equal(status.required, false);
  assert.equal(status.installed, false);
  assert.equal(status.installable, false);
  assert.equal(status.processTapSupported, false);
  assert.deepEqual(status.loopbackDevices, [{ uid: 'loop', name: 'BlackHole 2ch' }]);
  assert.match(status.blocker, /No owned, signed audio driver/);
});

test('the helper lists devices without capturing and passes the process tap flag', async () => {
  const spawned = [];
  const audio = new SystemAudio(
    '/helper',
    () => {},
    () => {},
    {
      execFile: async (file, args) => ({
        stdout:
          JSON.stringify({
            event: 'devices',
            defaultOutputUID: 'speakers',
            devices: [
              { uid: 'speakers', name: 'MacBook Pro Speakers', isDefault: true, hasInput: false },
              { uid: 7, name: 'bad' },
            ],
          }) + '\n',
        file,
        args,
      }),
      spawn: (file, args) => {
        spawned.push(args);
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stdin = { writable: true, write() {} };
        child.kill = () => child.emit('exit');
        setImmediate(() => child.stdout.emit('data', Buffer.from('{"event":"started"}\n')));
        return child;
      },
    },
  );
  assert.deepEqual(await audio.listDevices(), {
    defaultOutputUID: 'speakers',
    devices: [{ uid: 'speakers', name: 'MacBook Pro Speakers', isDefault: true, hasInput: false }],
  });
  await audio.start('s1', '', false, { processTap: true });
  assert.deepEqual(spawned[0].slice(0, 1), ['--process-tap']);
});

test('an unexpected helper exit is reported once with its cause', async () => {
  const exits = [];
  let child;
  const audio = new SystemAudio(
    '/helper',
    () => {},
    () => {},
    {
      onExit: (event) => exits.push(event),
      spawn: () => {
        child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stdin = { writable: true, write() {} };
        child.kill = () => child.emit('exit');
        setImmediate(() => child.stdout.emit('data', Buffer.from('{"event":"started"}\n')));
        return child;
      },
    },
  );
  await audio.start('s1', '');
  child.emit('exit');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(exits, [{ unexpected: true }]);
  await audio.start('s1', '');
  await audio.stop();
  assert.deepEqual(exits, [{ unexpected: true }, { unexpected: false }]);
});
