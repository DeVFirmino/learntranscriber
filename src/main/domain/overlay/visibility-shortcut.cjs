// globalShortcut provides press/repeat, not key-up. Taps are delayed 650ms and a held
// panel's opacity is restored after 240ms without repeats. Settings suspension and teardown cancel pending work.
function createVisibilityShortcut({ concealed, toggle, fade, timers }) {
  let tap = null,
    reset = null,
    held = false,
    opacity = 1;
  function cancel() {
    timers.clearTimeout(tap);
    timers.clearTimeout(reset);
    tap = reset = null;
    if (held) fade(null);
    held = false;
    opacity = 1;
  }
  return {
    cancel,
    press() {
      if (concealed()) {
        cancel();
        toggle();
        return;
      }
      if (tap === null && !held) {
        tap = timers.setTimeout(() => {
          tap = null;
          toggle();
        }, 650);
        return;
      }
      timers.clearTimeout(tap);
      tap = null;
      timers.clearTimeout(reset);
      opacity = held ? Math.max(0.25, Math.round((opacity - 0.08) * 100) / 100) : 0.85;
      held = true;
      fade(opacity);
      reset = timers.setTimeout(cancel, 240);
    },
  };
}
module.exports = { createVisibilityShortcut };
