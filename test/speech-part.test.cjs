const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawnSpeechPart, writePcm, stopPart } = require('../src/main/infrastructure/native/speech-part.cjs');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.written = [];
  child.killed = [];
  child.stdin = {
    writable: true,
    writableLength: 0,
    write: (bytes) => child.written.push(bytes.length),
    end: () => {
      child.stdin.writable = false;
      setImmediate(() => child.emit('exit', 0));
    },
  };
  child.kill = (signal) => child.killed.push(signal);
  return child;
}

test('a part starts on its ready message, frames output lines and ends cleanly on stop', async () => {
  const child = fakeChild(),
    messages = [];
  let ended = 0;
  const { part, started } = spawnSpeechPart({
    spawn: (executable, args) => {
      assert.deepEqual(args.slice(-2), ['--speaker-label', 'THEY']);
      return child;
    },
    executable: '/helper',
    sessionId: 's1',
    locale: 'en-US',
    speaker: 'THEY',
    readyTimeout: 1000,
    onMessage: (message) => {
      messages.push(message);
      if (message.type === 'ready') {
        part.settled = part.ready = true;
        part.resolveReady(true);
      }
    },
    onOverflow: () => {},
    onEnded: () => ended++,
  });
  child.stdout.emit('data', Buffer.from('{"type":"ready"}\nnot json\n{"type":"par'));
  child.stdout.emit('data', Buffer.from('tial","text":"hi"}\n'));
  assert.equal(await started, true);
  assert.deepEqual(messages, [{ type: 'ready' }, { type: 'partial', text: 'hi' }]);
  assert.equal(writePcm(part, new ArrayBuffer(130000)), true);
  assert.deepEqual(child.written, [64000, 64000, 2000]);
  await stopPart(part, 1000);
  assert.equal(part.ended, true);
  assert.equal(ended, 1);
  assert.deepEqual(child.killed, []);
  assert.throws(() => writePcm(part, new ArrayBuffer(2)), /not ready/);
});

test('a part that exits before it is ready rejects its start', async () => {
  const child = fakeChild();
  const { started } = spawnSpeechPart({
    spawn: () => child,
    executable: '/helper',
    sessionId: 's1',
    locale: 'en-US',
    speaker: 'ME',
    readyTimeout: 1000,
    onMessage: () => {},
    onOverflow: () => {},
    onEnded: () => assert.fail('a part that never started does not end'),
  });
  child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await assert.rejects(started, /helper is not built/);
});
