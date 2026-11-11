const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { SystemAudio } = require('../src/main/infrastructure/native/system-audio.cjs');

const audio = (bytes) => JSON.stringify({ event: 'audio', samples: Buffer.from(bytes).toString('base64') }) + '\n';

test('the process tap following a new default output keeps the same capture running', async () => {
  let child;
  const chunks = [],
    errors = [],
    exits = [],
    routes = [];
  const manager = new SystemAudio(
    '/fixture',
    (packet) => chunks.push(Buffer.from(packet.bytes).subarray(44)),
    (message) => errors.push(message),
    {
      onExit: (value) => exits.push(value),
      onRoute: (value) => routes.push(value),
      spawn: (_file, args) => {
        assert.ok(args.includes('--process-tap'));
        child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stdin = new PassThrough();
        child.kill = () => child.emit('exit', 0);
        child.stdin.on('data', () => child.emit('exit', 0));
        return child;
      },
    },
  );
  const starting = manager.start('session', null, false, { processTap: true });
  child.stdout.write('{"event":"started"}\n');
  await starting;
  child.stdout.write(audio([1, 0]));
  // The native helper's events around a default output change.
  child.stdout.write('{"event":"reconnecting","reason":"default output changed"}\n');
  child.stdout.write('{"deviceId":"usb-1","deviceName":"Desk Speakers","event":"device-changed"}\n');
  child.stdout.write(audio([2, 0]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(chunks, [Buffer.from([1, 0]), Buffer.from([2, 0])]);
  assert.equal(manager.child, child);
  assert.deepEqual(errors, []);
  assert.deepEqual(routes, [
    { event: 'reconnecting', reason: 'default output changed' },
    { event: 'device-changed', deviceId: 'usb-1', deviceName: 'Desk Speakers' },
  ]);
  await manager.stop();
  assert.deepEqual(exits, [{ unexpected: false }]);
});
