// Ordered quit: recordings flush, then recorded audio stops being accepted and every accepted
// segment and live session drains, requests settle, and only then runtimes close. Every close runs
// even when another one fails. SQLite stays open until will-quit, after this sequence finishes.
const NEW_WORK = new Set([
  'ai:generate',
  'assistants:build',
  'live:start',
  'audio:native-start',
  'sessions:create',
  'sessions:resume',
]);
// Recorded audio is still accepted while the renderer flushes its last segments, and refused after.
const RECORDED_AUDIO = new Set(['audio:transcribe', 'live:push', 'transcript:append', 'memory:transcribe']);
const TIMED_OUT = Symbol('timed out');

function withTimeout(promise, ms, timers) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = timers.setTimeout(() => resolve(TIMED_OUT), ms);
      timer?.unref?.();
    }),
  ]).finally(() => timers.clearTimeout(timer));
}

function createShutdown({
  flushRecordings,
  drainTranscription,
  drainSegments = async () => {},
  abortRequests,
  pendingRequests,
  closeResources,
  timers,
  now,
  log = console.error,
  flushTimeoutMs = 8000,
  requestTimeoutMs = 5000,
  stepTimeoutMs = 5000,
  poll = 50,
}) {
  let phase = 'running',
    done = null;
  const step = async (label, work) => {
    try {
      await work;
    } catch (error) {
      log(`Shutdown step failed (${label}):`, error?.message || error);
    }
  };
  // A drain or close that never settles must not keep the app from quitting; it is logged and skipped.
  const bounded = (label, work) =>
    step(
      label,
      withTimeout(work, stepTimeoutMs, timers).then((result) => {
        if (result === TIMED_OUT) log(`Shutdown: ${label} did not finish within ${stepTimeoutMs} ms; quitting anyway.`);
      }),
    );
  const waitRequests = async () => {
    const deadline = now() + requestTimeoutMs;
    while (pendingRequests() > 0 && now() < deadline) await new Promise((resolve) => timers.setTimeout(resolve, poll));
  };
  return {
    get phase() {
      return phase;
    },
    accepts(channel) {
      if (NEW_WORK.has(channel)) return phase === 'running';
      if (RECORDED_AUDIO.has(channel)) return phase === 'running' || phase === 'flushing';
      return true;
    },
    run() {
      if (done) return done;
      phase = 'flushing';
      done = (async () => {
        await step(
          'flush recordings',
          withTimeout(Promise.resolve().then(flushRecordings), flushTimeoutMs, timers).then((result) => {
            if (result === TIMED_OUT)
              log(
                'Shutdown: the workspace did not finish flushing its recording; audio it had not sent was discarded.',
              );
          }),
        );
        phase = 'draining';
        await bounded('drain recorded segments', Promise.resolve().then(drainSegments));
        await bounded('drain transcription', Promise.resolve().then(drainTranscription));
        abortRequests();
        await step('settle requests', waitRequests());
        phase = 'closing';
        const closing = Promise.resolve()
          .then(closeResources)
          .then((resources) => Promise.allSettled(resources))
          .then((results) => {
            for (const result of results)
              if (result.status === 'rejected') log('Shutdown close failed:', result.reason?.message || result.reason);
          });
        await bounded('close resources', closing);
        phase = 'closed';
      })();
      return done;
    },
  };
}

module.exports = { createShutdown, NEW_WORK };
