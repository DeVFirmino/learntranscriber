const { abortsWithOwner } = require('./owner-bound-requests.cjs');

// Cancellable model requests. Each request has a unique id, belongs to the window that started it, times out,
// and is removed however it ends.
function createRequestRegistry({ timers, requests = new Map() }) {
  return {
    has: (id) => requests.has(id),
    async run({ id, owner, sessionId, mode, timeoutMs }, work) {
      if (requests.has(id)) throw new Error('Request ID already in use.');
      const controller = new AbortController(),
        timer = timers.setTimeout(
          () => controller.abort(new DOMException('Request timed out.', 'TimeoutError')),
          timeoutMs,
        );
      requests.set(id, { controller, owner, sessionId, mode });
      try {
        return await work(controller.signal);
      } finally {
        timers.clearTimeout(timer);
        requests.delete(id);
      }
    },
    busy: () => requests.size > 0,
    pending: () => requests.size,
    cancelMode(mode) {
      for (const request of requests.values()) if (request.mode === mode) request.controller.abort();
    },
    cancelSession(sessionId) {
      for (const request of requests.values()) if (request.sessionId === sessionId) request.controller.abort();
    },
    cancelOwner(ownerId) {
      for (const request of requests.values()) if (abortsWithOwner(request, ownerId)) request.controller.abort();
    },
    cancelAll() {
      for (const { controller } of requests.values()) controller.abort();
    },
    cancel(id, owner) {
      const request = requests.get(id);
      if (request && request.owner === owner) request.controller.abort();
      return true;
    },
  };
}
module.exports = { createRequestRegistry };
