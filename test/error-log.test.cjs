const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createErrorLog } = require('../src/main/infrastructure/files/error-log.cjs');

const now = () => new Date('2026-11-03T12:00:00.000Z');

function folder(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'error-log-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, 'Logs', 'LearnTranscriber');
}

test('the log folder appears with the first line and both are private to the user', (t) => {
  const directory = folder(t);
  const log = createErrorLog({ directory, now });
  assert.equal(fs.existsSync(directory), false);
  log.write('error', ['First failure']);
  log.write('warn', ['Second']);
  const file = path.join(directory, 'main.log');
  assert.equal(
    fs.readFileSync(file, 'utf8'),
    '2026-11-03T12:00:00.000Z ERROR First failure\n2026-11-03T12:00:00.000Z WARN Second\n',
  );
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('past the size limit the log rolls over to one older file', (t) => {
  const directory = folder(t);
  const log = createErrorLog({ directory, now, maxBytes: 60 });
  log.write('error', ['a'.repeat(80)]);
  log.write('error', ['after rollover']);
  log.write('error', ['b'.repeat(80)]);
  log.write('error', ['latest']);
  assert.deepEqual(fs.readdirSync(directory).sort(), ['main.log', 'main.old.log']);
  assert.match(fs.readFileSync(path.join(directory, 'main.log'), 'utf8'), /latest/);
  assert.match(fs.readFileSync(path.join(directory, 'main.old.log'), 'utf8'), /b{80}/);
});

test('a folder that cannot be written never throws into the app', (t) => {
  const directory = folder(t);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  fs.writeFileSync(directory, 'a file where the folder should be');
  assert.doesNotThrow(() => createErrorLog({ directory, now }).write('error', ['lost']));
});

test('console errors and warnings still print and also reach the log', (t) => {
  const { composeErrorLog } = require('../src/main/composition/error-log.cjs');
  const directory = folder(t);
  const printed = [];
  const target = {
    error: (...parts) => printed.push(['error', ...parts]),
    warn: (...parts) => printed.push(['warn', ...parts]),
    log: () => printed.push(['log']),
  };
  composeErrorLog({ app: { getPath: (name) => name === 'logs' && directory }, console: target, now });
  target.error('Startup failed:', 'disk full');
  target.warn('Slow renderer');
  target.log('not logged');
  assert.deepEqual(printed, [['error', 'Startup failed:', 'disk full'], ['warn', 'Slow renderer'], ['log']]);
  assert.equal(
    fs.readFileSync(path.join(directory, 'main.log'), 'utf8'),
    '2026-11-03T12:00:00.000Z ERROR Startup failed: disk full\n2026-11-03T12:00:00.000Z WARN Slow renderer\n',
  );
});
