const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { NativeContext } = require('../src/main/infrastructure/native/context-helper.cjs');
const { createSelectionWatcher } = require('../src/main/application/context/selection-watcher.cjs');
const { createCopyWatcher } = require('../src/main/application/context/copy-watcher.cjs');
test('OCR files are private and removed after success and helper failure', async () => {
  const paths = [];
  const helper = new NativeContext('/fixture', async (_file, args) => {
    const file = args[args.indexOf('--image') + 1];
    paths.push(file);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    const data = await fs.readFile(file);
    if (data[0] === 2) throw Object.assign(new Error('fixture'), { stdout: '{"error":"OCR fixture rejected"}' });
    return { stdout: '{"text":"Local OCR result"}' };
  });
  assert.equal((await helper.ocr(Buffer.from([1]))).text, 'Local OCR result');
  await assert.rejects(helper.ocr(Buffer.from([2])), /fixture rejected/);
  for (const file of paths) await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});
test('selection watcher ignores the initial selection, deduplicates and stops when disabled', async () => {
  let value = { text: 'existing', application: 'Fixture' },
    reads = 0;
  const selected = [];
  const watcher = createSelectionWatcher({
    timers: { setInterval, clearInterval },
    read: async () => {
      reads++;
      return value;
    },
    onSelection: (r) => selected.push(r),
    onError: () => {},
    interval: 60000,
  });
  watcher.update('session', true);
  await new Promise(setImmediate);
  assert.equal(selected.length, 0);
  value = { text: 'new <selection>', application: 'Fixture' };
  await watcher.tick();
  await watcher.tick();
  assert.equal(selected.length, 1);
  assert.equal(selected[0].sessionId, 'session');
  assert.equal(selected[0].text, 'new <selection>');
  watcher.update('session', false);
  const before = reads;
  await watcher.tick();
  assert.equal(reads, before);
  watcher.close();
});
test('a selection arriving after session change or concealment is discarded', async () => {
  let resolve;
  const selected = [];
  const watcher = createSelectionWatcher({
    timers: { setInterval, clearInterval },
    read: () =>
      new Promise((r) => {
        resolve = r;
      }),
    onSelection: (r) => selected.push(r),
    onError: () => {},
    interval: 60000,
  });
  watcher.update('first', true);
  watcher.update(null, false);
  resolve({ text: 'late private text' });
  await new Promise(setImmediate);
  assert.equal(selected.length, 0);
  watcher.close();
});
test('selection permission failure stops polling and reports a recoverable error', async () => {
  const errors = [];
  let reads = 0;
  const watcher = createSelectionWatcher({
    timers: { setInterval, clearInterval },
    read: async () => {
      reads++;
      throw new Error('Enable Accessibility');
    },
    onSelection: () => {},
    onError: (error) => errors.push(error),
    interval: 60000,
  });
  watcher.update('session', true);
  await new Promise(setImmediate);
  await watcher.tick();
  assert.deepEqual(errors, ['Enable Accessibility']);
  assert.equal(reads, 1);
  watcher.close();
});

test('copy prompts await asynchronous clipboard reads and ignore the initial clipboard', async (t) => {
  let text = 'Initial clipboard';
  const copies = [];
  const errors = [];
  const watcher = createCopyWatcher({
    timers: { setInterval, clearInterval },
    readClipboard: async () => text,
    readSelection: async () => ({ text }),
    onCopy: (value) => copies.push(value),
    onError: (error) => errors.push(error),
    interval: 60000,
  });
  t.after(() => watcher.close());
  watcher.update('s1', true);
  await new Promise(setImmediate);
  assert.equal(copies.length, 0);
  text = 'New selected text';
  await watcher.tick();
  await watcher.tick();
  assert.equal(copies.length, 1);
  assert.equal(copies[0].text, text);
  assert.equal(copies[0].sessionId, 's1');
  assert.deepEqual(errors, []);
});

test('a late asynchronous clipboard read is ignored after the watcher closes', async () => {
  let release;
  const copies = [],
    errors = [];
  const watcher = createCopyWatcher({
    timers: { setInterval, clearInterval },
    readClipboard: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    readSelection: async () => ({ text: 'Late' }),
    onCopy: (value) => copies.push(value),
    onError: (error) => errors.push(error),
    interval: 60000,
  });
  watcher.update('s1', true);
  watcher.close();
  release('Late');
  await new Promise(setImmediate);
  assert.deepEqual(copies, []);
  assert.deepEqual(errors, []);
});

test('asynchronous clipboard failures are reported without crashing session publication', async (t) => {
  const errors = [];
  const watcher = createCopyWatcher({
    timers: { setInterval, clearInterval },
    readClipboard: async () => {
      throw new Error('Clipboard unavailable');
    },
    readSelection: async () => ({}),
    onCopy: () => assert.fail('No copy expected'),
    onError: (error) => errors.push(error),
    interval: 60000,
  });
  t.after(() => watcher.close());
  assert.doesNotThrow(() => watcher.update('s1', true));
  await new Promise(setImmediate);
  assert.deepEqual(errors, ['Clipboard unavailable']);
});
