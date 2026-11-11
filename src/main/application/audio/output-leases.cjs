// One shared incoming-audio capture, held by leases, with this contract:
// - A lease is scoped to its window (`<owner>:<lease>`). The capture starts with the first lease and stops when the
//   last one is released; an abandoned lease is dropped without stopping the capture.
// - Concurrent starts share one start. A start finished after a stop is undone and reported as cancelled.
// - A lease for another session restarts the capture for that session; leases of the old session are dropped.
// - When the capture ends unexpectedly the leases stay, and the next acquire starts it again.
// - Releasing every lease of a window that closed, crashed or navigated stops a capture nobody holds.
function createOutputLeases({ capture, onState = () => {} }) {
  const leases = new Map();
  let running = null,
    starting = null,
    generation = 0;

  const scoped = (owner, lease) => {
    if (!Number.isInteger(owner) || typeof lease !== 'string' || !lease || lease.length > 100)
      throw new Error('Choose a valid audio lease.');
    return `${owner}:${lease}`;
  };
  const publish = (state, extra = {}) => onState({ state, leases: leases.size, ...running, ...extra });

  async function stopCapture(transient = false) {
    const was = running;
    running = null;
    await capture.stop();
    if (was) publish('stopped', { ...was, transient });
  }

  async function ensure(sessionId) {
    if (starting) {
      const pending = await starting.catch(() => null);
      if (pending && running?.sessionId === sessionId) return { ...running, alreadyActive: true };
    }
    if (running?.sessionId === sessionId) return { ...running, alreadyActive: true };
    const attempt = generation;
    starting = (async () => {
      if (running) {
        for (const [key, lease] of leases) if (lease.sessionId !== sessionId) leases.delete(key);
        await stopCapture(true);
      }
      const started = await capture.start(sessionId);
      if (attempt !== generation) {
        await capture.stop();
        return null;
      }
      running = {
        sessionId,
        route: started.route,
        ...(started.fellBack ? { fellBack: true, reason: started.reason } : {}),
      };
      publish('active');
      return running;
    })();
    try {
      const result = await starting;
      if (!result) return { cancelled: true, error: 'Incoming audio start was cancelled.' };
      return { ...result };
    } finally {
      starting = null;
    }
  }

  return {
    async acquire(owner, lease, sessionId) {
      const key = scoped(owner, lease),
        had = leases.has(key);
      leases.set(key, { owner, sessionId });
      try {
        const result = await ensure(sessionId);
        if (result.cancelled && !had) leases.delete(key);
        return { ...result, shared: leases.size > 1 };
      } catch (error) {
        if (!had) leases.delete(key);
        throw error;
      }
    },
    async release(owner, lease, { stopIfLast = true } = {}) {
      const key = scoped(owner, lease);
      if (!leases.delete(key)) return { alreadyReleased: true };
      if (leases.size || !stopIfLast) return { shared: leases.size > 0, remainingLeases: leases.size };
      generation++;
      await stopCapture();
      return { stopped: true };
    },
    async releaseOwner(owner) {
      let released = 0;
      for (const [key, lease] of leases)
        if (lease.owner === owner) {
          leases.delete(key);
          released++;
        }
      if (released && !leases.size) {
        generation++;
        await stopCapture();
      }
      return { released };
    },
    // Ending a session releases every lease.
    async stop() {
      leases.clear();
      generation++;
      await stopCapture();
    },
    // An explicit route change while capturing: the same session and leases continue on the new route.
    async restart() {
      if (!running) return { restarted: false };
      const { sessionId } = running;
      await stopCapture(true);
      return { ...(await ensure(sessionId)), restarted: true };
    },
    // The capture ended on its own (helper exit, permission revoked, device gone). Leases stay for the next acquire.
    ended(reason) {
      if (!running) return;
      const was = running;
      running = null;
      publish('stopped', { ...was, unexpected: true, reason });
    },
    // The helper followed a new default output: the capture and its leases continue, so only the state is published.
    route({ event, reason, deviceId, deviceName }) {
      if (!running) return;
      if (event === 'reconnecting') publish('reconnecting', { reason });
      if (event === 'device-changed') publish('active', { deviceId, deviceName });
    },
    status: () => ({ active: Boolean(running), leases: leases.size, ...running }),
  };
}

module.exports = { createOutputLeases };
