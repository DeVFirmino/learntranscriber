const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyGone, createRendererRecovery } = require('../src/main/infrastructure/electron/renderer-recovery.cjs');

function fixture() {
  const logs = [],
    pending = [];
  let time = 0;
  const recovery = createRendererRecovery({
    log: (message) => logs.push(message),
    now: () => time,
    timers: { setTimeout: (fn, ms) => pending.push({ fn, ms }) },
  });
  const window = {
    destroyed: false,
    reloads: 0,
    isDestroyed() {
      return this.destroyed;
    },
    reload() {
      this.reloads++;
    },
  };
  return { logs, pending, recovery, window, advance: (ms) => (time += ms) };
}

test('renderer exit reasons classify into report and recover flags', () => {
  const table = Object.fromEntries(
    ['clean-exit', 'killed', 'crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure', '', 'odd'].map(
      (reason) => {
        const { report, recover } = classifyGone(reason);
        return [reason, [report, recover]];
      },
    ),
  );
  assert.deepEqual(table, {
    'clean-exit': [false, false],
    killed: [false, true],
    crashed: [true, true],
    oom: [true, true],
    'abnormal-exit': [true, true],
    'launch-failed': [true, false],
    'integrity-failure': [true, false],
    '': [true, false],
    odd: [true, false],
  });
  assert.equal(classifyGone(undefined).reason, 'unknown');
  assert.equal(classifyGone('toString').recover, false);
});

test('a recoverable renderer exit reloads the window after one second, unless it was destroyed meanwhile', () => {
  const { pending, recovery, window } = fixture();
  assert.equal(recovery.rendererGone(window, 'overlay', { reason: 'killed' }), true);
  assert.equal(recovery.rendererGone(window, 'overlay', { reason: 'clean-exit' }), false);
  assert.equal(recovery.rendererGone(window, 'overlay', { reason: 'launch-failed' }), false);
  assert.deepEqual(
    pending.map((timer) => timer.ms),
    [1000],
  );
  pending[0].fn();
  assert.equal(window.reloads, 1);
  recovery.rendererGone(window, 'overlay', { reason: 'crashed' });
  window.destroyed = true;
  pending.at(-1).fn();
  assert.equal(window.reloads, 1);
});

test('failures are logged once per reason every five minutes, and benign exits are not logged', () => {
  const { logs, recovery, window, advance } = fixture();
  recovery.rendererGone(window, 'main', { reason: 'crashed', exitCode: 11 });
  recovery.rendererGone(window, 'main', { reason: 'crashed', exitCode: 11 });
  recovery.rendererGone(window, 'main', { reason: 'oom', exitCode: 0 });
  recovery.rendererGone(window, 'main', { reason: 'killed', exitCode: 9 });
  advance(5 * 60 * 1000);
  recovery.rendererGone(window, 'notch', { reason: 'crashed', exitCode: 11 });
  assert.deepEqual(logs, [
    'Renderer process gone (main): crashed, exit code 11.',
    'Renderer process gone (main): oom, exit code 0.',
    'Renderer process gone (notch): crashed, exit code 11.',
  ]);
});

test('only abnormal GPU process exits are logged', () => {
  const { logs, recovery } = fixture();
  recovery.childGone({ type: 'GPU', reason: 'killed', exitCode: 9 });
  recovery.childGone({ type: 'GPU', reason: 'clean-exit', exitCode: 0 });
  recovery.childGone({ type: 'Utility', reason: 'crashed', exitCode: 1 });
  recovery.childGone({ type: 'GPU', reason: 'crashed', exitCode: 133 });
  assert.deepEqual(logs, ['GPU process gone: crashed, exit code 133.']);
});
