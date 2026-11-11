// Polls the focused app's selection while a session allows it and reports each new nonempty selection. The first
// read is only a baseline; a failed read turns the watcher off and reports why.
function createSelectionWatcher({ read, onSelection, onError, interval = 1800, timers }) {
  let sessionId = null,
    last = null,
    generation = 0,
    busy = false,
    timer = null,
    controller = null;
  function update(id, enabled) {
    const next = enabled ? id : null;
    if (next === sessionId) return;
    generation++;
    controller?.abort();
    timers.clearInterval(timer);
    sessionId = next;
    last = null;
    if (next) {
      timer = timers.setInterval(() => void tick(), interval);
      timer.unref?.();
      void tick();
    }
  }
  async function tick() {
    if (!sessionId || busy) return;
    busy = true;
    const current = generation,
      id = sessionId,
      reading = new AbortController();
    controller = reading;
    try {
      const result = await read(reading.signal);
      if (current !== generation) return;
      const value = result.text?.trim().slice(0, 20000) || '';
      const signature = JSON.stringify([value, result.application || '']);
      if (last === null) {
        last = signature;
        return;
      }
      if (last === signature) return;
      last = signature;
      if (value) onSelection({ ...result, text: value, sessionId: id });
    } catch (error) {
      if (current === generation && !reading.signal.aborted) {
        update(null, false);
        onError(error.message);
      }
    } finally {
      busy = false;
      if (controller === reading) controller = null;
    }
  }
  return { update, tick, close: () => update(null, false) };
}
module.exports = { createSelectionWatcher };
