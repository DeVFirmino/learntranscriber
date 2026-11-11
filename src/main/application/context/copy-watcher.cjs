// Polls the clipboard while a session allows it and reports a newly copied value only when it matches the focused
// app's selection, so copying a password from a manager never becomes a prompt. The first read is a baseline.
function createCopyWatcher({ readClipboard, readSelection, onCopy, onError, interval = 900, timers }) {
  let sessionId = null,
    previous = null,
    version = 0,
    busy = false,
    timer = null;
  function close() {
    timers.clearInterval(timer);
    version++;
    sessionId = null;
    previous = null;
    busy = false;
  }
  async function tick() {
    if (!sessionId || busy) return;
    const current = version,
      id = sessionId;
    busy = true;
    try {
      const value = (await readClipboard()).slice(0, 20000);
      if (current !== version) return;
      if (previous === null) {
        previous = value;
        return;
      }
      if (!value || value === previous) return;
      previous = value;
      const selected = await readSelection();
      if (current === version && selected.text?.trim() === value.trim())
        await onCopy({ ...selected, text: value, sessionId: id });
    } catch (error) {
      if (current === version) onError(error.message);
    } finally {
      if (current === version) busy = false;
    }
  }
  return {
    update(id, enabled) {
      const next = enabled ? id : null;
      if (next === sessionId) return;
      close();
      sessionId = next;
      if (next) {
        timer = timers.setInterval(() => void tick(), interval);
        timer.unref?.();
        void tick();
      }
    },
    tick,
    close,
  };
}
module.exports = { createCopyWatcher };
