// Renderer and GPU process failures. A renderer that crashed, ran out of memory, exited abnormally or was killed by the
// system is reloaded after one second; a clean exit, a failed launch, an integrity failure or an unknown reason is
// left alone. Failures go to the local log only, at most once
// per reason every five minutes. GPU process exits are only logged.
const RECOVERY_DELAY_MS = 1000;
const REPORT_INTERVAL_MS = 5 * 60 * 1000;
const REASONS = Object.freeze({
  'clean-exit': { report: false, recover: false },
  killed: { report: false, recover: true },
  crashed: { report: true, recover: true },
  oom: { report: true, recover: true },
  'abnormal-exit': { report: true, recover: true },
  'launch-failed': { report: true, recover: false },
  'integrity-failure': { report: true, recover: false },
});

function classifyGone(reason) {
  const name = typeof reason === 'string' && reason ? reason : 'unknown';
  return { reason: name, report: true, recover: false, ...(Object.hasOwn(REASONS, name) ? REASONS[name] : {}) };
}

function createRendererRecovery({
  log = (message) => console.warn(message),
  now = Date.now,
  timers = { setTimeout },
} = {}) {
  const reported = new Map();
  const report = (message, reason) => {
    const last = reported.get(reason);
    if (Number.isFinite(last) && now() - last < REPORT_INTERVAL_MS) return;
    reported.set(reason, now());
    log(message);
  };
  return {
    rendererGone(window, role, details = {}) {
      const gone = classifyGone(details.reason);
      if (gone.report)
        report(`Renderer process gone (${role}): ${gone.reason}, exit code ${details.exitCode}.`, gone.reason);
      if (!gone.recover) return false;
      const timer = timers.setTimeout(() => {
        if (!window.isDestroyed()) window.reload();
      }, RECOVERY_DELAY_MS);
      timer?.unref?.();
      return true;
    },
    childGone(details = {}) {
      if (details.type !== 'GPU' || details.reason === 'killed' || details.reason === 'clean-exit') return;
      log(`GPU process gone: ${classifyGone(details.reason).reason}, exit code ${details.exitCode}.`);
    },
  };
}

module.exports = { classifyGone, createRendererRecovery, RECOVERY_DELAY_MS, REPORT_INTERVAL_MS };
