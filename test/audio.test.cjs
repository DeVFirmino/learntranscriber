const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeSpeech } = require('../src/main/infrastructure/native/speech-helper.cjs');

test('Apple Speech jobs are serialized and temporary audio is removed after success or failure', async () => {
  const fs = require('node:fs/promises');
  let active = 0,
    maximum = 0;
  const paths = [];
  const native = new NativeSpeech('/fixture/helper', async (_executable, args) => {
    const path = args[args.indexOf('--audio') + 1];
    paths.push(path);
    active++;
    maximum = Math.max(active, maximum);
    const stats = await fs.stat(path);
    assert.equal(stats.mode & 0o777, 0o600);
    const bytes = await fs.readFile(path);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    if (bytes[0] === 2)
      throw Object.assign(new Error('native error'), {
        stdout: JSON.stringify({ error: 'Permission denied by fixture' }),
      });
    return { stdout: JSON.stringify({ text: 'Local transcript' }) };
  });
  const results = await Promise.allSettled([
    native.transcribe(Buffer.from([1]), 'en-US'),
    native.transcribe(Buffer.from([2]), 'pt-BR'),
  ]);
  assert.equal(results[0].value, 'Local transcript');
  assert.match(results[1].reason.message, /Permission denied/);
  assert.equal(maximum, 1);
  for (const path of paths) await assert.rejects(fs.stat(path), { code: 'ENOENT' });
});
test('Apple Speech language operations wait for recognition and can stop waiting without changing other locales', async () => {
  let finishRecognition,
    languageStarted = false;
  const calls = [];
  const native = new NativeSpeech('/fixture/helper', async (_file, args, options) => {
    calls.push(args);
    if (args.includes('--audio')) {
      await new Promise((resolve) => {
        finishRecognition = resolve;
      });
      return { stdout: '{"text":"Fixture audio"}' };
    }
    if (args.includes('--list-assets')) return { stdout: '{"assetManagementAvailable":false}' };
    languageStarted = true;
    assert.equal(options.timeout, 600000);
    return await new Promise((_resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
    );
  });
  const recognition = native.transcribe(Buffer.from([1]), 'en-US');
  while (!finishRecognition) await new Promise(setImmediate);
  const install = native.manageLocale('install', 'pt-BR');
  await new Promise(setImmediate);
  assert.equal(languageStarted, false);
  finishRecognition();
  await recognition;
  while (!languageStarted) await new Promise(setImmediate);
  native.cancelAssetOperation();
  await assert.rejects(install, { name: 'AbortError' });
  assert.equal(
    calls.some((args) => args.includes('--release-locale')),
    false,
  );
  native.close();
});
