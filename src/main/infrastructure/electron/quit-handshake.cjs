// Before quitting, the workspace renderer is asked to flush the recorded segments it still holds; quitting
// continues when it answers, or at once when there is no workspace window.
function quitHandshake({ main, log = console.error }) {
  let answer = null;
  return {
    flush: () =>
      new Promise((resolve) => {
        const window = main();
        if (!window || window.isDestroyed()) return resolve();
        answer = resolve;
        window.webContents.send('app:prepare-quit');
      }),
    ready({ discardedSegments } = {}) {
      if (discardedSegments)
        log(`Quit: ${discardedSegments} recorded segment(s) could not be transcribed and were discarded.`);
      answer?.();
      answer = null;
    },
  };
}
module.exports = { quitHandshake };
