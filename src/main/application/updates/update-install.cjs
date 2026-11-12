// Downloads one release's DMG and opens it when asked, tracking the download so the banner can show it. Installing
// stays with the person: opening the DMG shows its window, where they drag the app to Applications. One download runs
// at a time; asking again for the same release while it runs, or once it is ready, changes nothing.
function createUpdateInstall({ download, openFile, changed }) {
  let current = { phase: 'idle', tagName: null, progress: null, file: null, error: null };
  const set = (next) => {
    current = { ...current, ...next };
    changed();
  };
  return {
    state: (tagName) =>
      current.tagName === tagName
        ? { phase: current.phase, progress: current.progress, error: current.error }
        : { phase: 'idle', progress: null, error: null },
    async start(tagName, version) {
      if (current.tagName === tagName && ['downloading', 'ready'].includes(current.phase)) return;
      if (current.phase === 'downloading') return;
      set({ phase: 'downloading', tagName, progress: 0, file: null, error: null });
      try {
        const file = await download(tagName, version, (progress) => {
          current = { ...current, progress };
          changed();
        });
        set({ phase: 'ready', file, progress: 1 });
      } catch (error) {
        set({ phase: 'failed', progress: null, error: error.message || String(error) });
      }
    },
    // Opens the verified DMG; false when there is none ready for this release.
    async open(tagName) {
      if (current.tagName !== tagName || current.phase !== 'ready') return false;
      await openFile(current.file);
      return true;
    },
  };
}
module.exports = { createUpdateInstall };
