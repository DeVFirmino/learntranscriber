// Reopening the app, a failed start, and quitting. The first quit while local models run waits for the ordered
// shutdown and quits again; that second quit closes what is left.
function composeLifecycle({ electron: { app, globalShortcut }, core, started, markQuitting }) {
  let closingLocal = false;
  return {
    showMain: () => core.windows.showMain(),
    // Reopening the app brings back its floating bar when it opens floating; Home on the bar opens the workspace.
    // Opening it again is a deliberate request to see it, so it also ends an emergency hide.
    activate() {
      if (!started.privacy) return;
      if (started.privacy.concealed) started.privacy.restore();
      if (started.repositories.settings.read().launchFloating) core.windows.showOverlay();
      else core.windows.showMain();
    },
    startupFailed() {
      started.sessionTitles?.close();
      started.updates?.close();
      markQuitting();
    },
    beforeQuit(event) {
      started.sessionTitles?.close();
      started.updates?.close();
      void started.transcriptCompactor?.close();
      if (started.localModels && !closingLocal) {
        event.preventDefault();
        closingLocal = true;
        core.screenInsights.cancel();
        started.selectionWatcher?.close();
        started.copyWatcher?.close();
        started.runtimeInstaller?.close();
        started.chatgptAuth?.close();
        void core.shutdown.run().finally(() => app.quit());
        return;
      }
      markQuitting();
      started.selectionWatcher?.close();
      started.copyWatcher?.close();
      core.nativeContext.close();
      core.nativeSpeech.close();
      core.requests.cancelAll();
    },
    willQuit() {
      void started.transcriptCompactor?.close();
      started.visibility?.cancel();
      started.shortcutRegistry?.close();
      globalShortcut.unregisterAll();
      started.repositories?.db.close();
    },
  };
}
module.exports = { composeLifecycle };
