const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

// Characterization of the built native helpers in their permission-free modes. The JSON here is the
// protocol src/main depends on; a refactor of the Swift side must leave every line unchanged.
const directory = path.resolve(__dirname, '../.local/native');
const built = ['apple-speech', 'system-audio', 'context-helper'].every((name) =>
  existsSync(path.join(directory, name)),
);

function run(name, args) {
  const result = spawnSync(path.join(directory, name), args, { input: '', timeout: 30000, encoding: 'utf8' });
  const lines = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { status: result.status, lines, stderr: result.stderr };
}

test(
  'apple-speech embeds the privacy purpose required before requesting recognition permission',
  { skip: !built && 'native helpers are not built' },
  () => {
    const result = spawnSync('/usr/bin/otool', ['-P', path.join(directory, 'apple-speech')], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const start = result.stdout.indexOf('<?xml');
    assert.ok(start >= 0, 'the standalone helper must contain its own Info.plist');
    const plist = spawnSync(
      '/usr/bin/plutil',
      ['-extract', 'NSSpeechRecognitionUsageDescription', 'raw', '-o', '-', '-'],
      {
        input: result.stdout.slice(start),
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    assert.equal(plist.status, 0, plist.stderr || plist.stdout);
    assert.ok(plist.stdout.trim().length > 0, 'the speech permission prompt needs a nonempty explanation');
  },
);

test('apple-speech reports capabilities without prompting', { skip: !built && 'native helpers are not built' }, () => {
  const { status, lines } = run('apple-speech', ['--capabilities', '--locale', 'en-US']);
  assert.equal(status, 0);
  assert.equal(lines.length, 1);
  const [reply] = lines;
  assert.equal(reply.locale, 'en-US');
  assert.ok(['authorized', 'denied', 'restricted', 'notDetermined', 'unknown'].includes(reply.authorization));
  assert.ok(['SFSpeechRecognizer', 'SpeechTranscriber'].includes(reply.engine));
  assert.equal(typeof reply.supportsOnDeviceRecognition, 'boolean');
  assert.equal(typeof reply.supportsStreamingRecognition, 'boolean');
  assert.ok(Array.isArray(reply.locales) && reply.locales.includes('en-US'));
  assert.deepEqual(Object.keys(reply).sort(), [
    'authorization',
    'engine',
    'locale',
    'locales',
    'supportsOnDeviceRecognition',
    'supportsStreamingRecognition',
  ]);
});

test(
  'apple-speech lists language assets or says management is unavailable',
  { skip: !built && 'native helpers are not built' },
  () => {
    const { status, lines } = run('apple-speech', ['--list-assets', '--locale', 'en-US']);
    assert.equal(status, 0);
    assert.equal(lines.length, 1);
    const [reply] = lines;
    assert.equal(typeof reply.assetManagementAvailable, 'boolean');
    if (reply.assetManagementAvailable) {
      assert.deepEqual(Object.keys(reply).sort(), [
        'assetManagementAvailable',
        'installedLocales',
        'locales',
        'maximumReservedLocales',
        'reservedLocales',
      ]);
      assert.ok(Number.isInteger(reply.maximumReservedLocales));
    } else assert.deepEqual(Object.keys(reply), ['assetManagementAvailable']);
  },
);

test(
  'apple-speech refuses missing arguments with the same messages and exit codes',
  { skip: !built && 'native helpers are not built' },
  () => {
    const plain = run('apple-speech', []);
    assert.equal(plain.status, 1);
    assert.deepEqual(plain.lines, [{ error: 'Supply --capabilities or --audio <file> and --locale <locale>.' }]);
    const session = run('apple-speech', ['--mode', 'session']);
    assert.equal(session.status, 1);
    assert.deepEqual(session.lines, [
      {
        type: 'error',
        sessionId: '',
        speakerLabel: '',
        error: 'Supply --capabilities or --audio <file> and --locale <locale>.',
      },
    ]);
    for (const args of [
      ['--mode', 'session', '--session-id', 's1', '--speaker-label', 'ME', '--language'],
      ['--mode', 'session', '--session-id', 's1', '--speaker-label', 'ME', '--bogus'],
    ]) {
      const malformed = run('apple-speech', args);
      assert.equal(malformed.status, 1, args.join(' '));
      assert.deepEqual(malformed.lines, [
        {
          type: 'error',
          sessionId: 's1',
          speakerLabel: 'ME',
          error: 'Supply --capabilities or --audio <file> and --locale <locale>.',
        },
      ]);
    }
    const missing = run('apple-speech', ['--audio', '/nonexistent.wav', '--locale', 'en-US']);
    assert.equal(missing.status, 1);
    assert.deepEqual(missing.lines, [{ error: 'Supply --capabilities or --audio <file> and --locale <locale>.' }]);
  },
);

test(
  'system-audio reports status and plays a one-second self-test tone without capturing',
  { skip: !built && 'native helpers are not built' },
  () => {
    const status = run('system-audio', ['--status']);
    assert.equal(status.status, 0);
    assert.deepEqual(Object.keys(status.lines[0]).sort(), [
      'event',
      'permissionGranted',
      'processTapSupported',
      'supported',
    ]);
    assert.equal(typeof status.lines[0].processTapSupported, 'boolean');
    assert.equal(status.lines[0].event, 'status');
    assert.equal(status.lines[0].supported, true);
    const selfTest = run('system-audio', ['--self-test']);
    assert.equal(selfTest.status, 0);
    assert.deepEqual(
      selfTest.lines.map((line) => line.event),
      ['started', 'audio', 'stopped'],
    );
    const samples = Buffer.from(selfTest.lines[1].samples, 'base64');
    assert.equal(samples.length, 16000 * 2, 'one second of 16 kHz PCM16');
    assert.equal(samples.readInt16LE(0), 0);
    assert.equal(samples.readInt16LE(2), Math.trunc(Math.sin(0.04) * 4000));
  },
);

test(
  'context-helper reports trust, recognizes its own test image and refuses bad input',
  { skip: !built && 'native helpers are not built' },
  () => {
    const status = run('context-helper', ['--status']);
    assert.equal(status.status, 0);
    assert.deepEqual(Object.keys(status.lines[0]), ['trusted']);
    const selfTest = run('context-helper', ['--self-test']);
    assert.equal(selfTest.status, 0);
    assert.deepEqual(selfTest.lines, [{ text: 'Local context verification 4827' }]);
    const plain = run('context-helper', []);
    assert.equal(plain.status, 1);
    assert.deepEqual(plain.lines, [{ error: 'Choose --status, --selection or --image <file>.' }]);
    const missing = run('context-helper', ['--image', '/nonexistent.png']);
    assert.equal(missing.status, 1);
    assert.equal(Object.keys(missing.lines[0]).join(), 'error');
    assert.match(missing.lines[0].error, /nonexistent\.png/);
  },
);

test(
  'helpers keep the first of repeated options, tolerate non-numeric ids and refuse unknown flags',
  { skip: !built && 'native helpers are not built' },
  () => {
    const repeated = run('apple-speech', ['--capabilities', '--locale', 'en-US', '--locale', 'pt-BR']);
    assert.equal(repeated.status, 0);
    assert.equal(repeated.lines[0].locale, 'en-US');
    const display = run('system-audio', ['--status', '--display', 'bad']);
    assert.equal(display.status, 0);
    assert.equal(display.lines[0].event, 'status');
    const pid = run('context-helper', ['--status', '--exclude-pid', 'bad']);
    assert.equal(pid.status, 0);
    assert.deepEqual(Object.keys(pid.lines[0]), ['trusted']);
    // Unknown flags are a deliberate change: they used to be ignored and now fail, so typos surface.
    const unknown = run('context-helper', ['--status', '--bogus']);
    assert.equal(unknown.status, 1);
    assert.deepEqual(unknown.lines, [{ error: 'Choose --status, --selection or --image <file>.' }]);
  },
);
