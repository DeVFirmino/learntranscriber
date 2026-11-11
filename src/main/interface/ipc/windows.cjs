// Window and privacy channels. Only the floating assistant can resize or close itself, or ask the workspace to
// open the assistant import.
function registerWindows(handle, { callers, windows, mainActions, privacy, changed }) {
  function overlayCaller(event, message) {
    const window = callers.windowOf(event);
    if (callers.roleOf(event) !== 'overlay') throw new Error(message);
    return window;
  }
  // Only the workspace, which owns recording, reports whether it is listening.
  handle('audio:listening', (event, active, starting = false, paused = false) => {
    if (
      callers.roleOf(event) !== 'main' ||
      typeof active !== 'boolean' ||
      typeof starting !== 'boolean' ||
      typeof paused !== 'boolean' ||
      (active && starting) ||
      (paused && !active)
    )
      throw new Error('Invalid listening report.');
    windows.setListening(active, starting, paused);
    return true;
  });
  // The workspace's live loudness of each side, from 0 to 1, drives the floating bar's wave.
  handle('audio:levels', (event, levels) => {
    const level = (value) => typeof value === 'number' && value >= 0 && value <= 1;
    if (callers.roleOf(event) !== 'main' || !levels || !level(levels.me) || !level(levels.they))
      throw new Error('Invalid audio levels.');
    for (const window of [windows.main(), windows.bar()])
      if (window && !window.isDestroyed())
        window.webContents.send('audio:levels', { me: levels.me, they: levels.they });
    return true;
  });
  handle('audio:pause-toggle', () => {
    const main = windows.main();
    if (!main || main.isDestroyed()) throw new Error('The recording workspace is unavailable.');
    main.webContents.send('workspace:action', 'pauseRecording');
    return true;
  });
  handle('workspace:show-main', () => {
    windows.showMain();
    return true;
  });
  // Any window can send the user to AI sources, for example when a question has no model to run on.
  handle('workspace:open-ai-sources', () => {
    mainActions.open('openAiSources');
    return true;
  });
  handle('workspace:open-ai-models', () => {
    mainActions.open('openAiModels');
    return true;
  });
  handle('workspace:open-audio-sources', () => {
    mainActions.open('openAudioSources');
    return true;
  });
  handle('assistants:open-library', (event) => {
    overlayCaller(event, 'Only the floating assistant can open the assistant library.');
    mainActions.open('openAssistants');
    return true;
  });
  handle('privacy:hide', () => {
    privacy().conceal();
    changed();
    return privacy().status();
  });
  handle('privacy:restore', () => {
    privacy().restore();
    changed();
    return privacy().status();
  });
  handle('overlay:onboarding', (event, active) => {
    if (typeof active !== 'boolean') throw new Error('Invalid onboarding presentation.');
    windows.presentOnboarding(callers.windowOf(event), active);
    return true;
  });
  handle('overlay:compose', (_event, question) => {
    if (typeof question !== 'string' || question.length > 20000) throw new Error('Invalid question draft.');
    windows.showOverlay();
    const overlay = windows.overlay();
    if (!overlay || overlay.isDestroyed()) throw new Error('The floating assistant is unavailable.');
    windows.setOverlayExpanded(overlay, true);
    const deliver = () => {
      if (overlay.isDestroyed()) return;
      overlay.webContents.send('overlay:question-draft', question);
      overlay.focus();
    };
    if (overlay.webContents.isLoadingMainFrame()) overlay.webContents.once('did-finish-load', deliver);
    else deliver();
    return true;
  });
  handle('overlay:show', (event, expanded = false) => {
    if (typeof expanded !== 'boolean') throw new Error('Invalid floating assistant request.');
    if (expanded) windows.setOverlayExpanded(callers.windowOf(event), true);
    windows.showOverlay();
    if (expanded) {
      const panel = windows.overlay();
      panel.focus();
      panel.webContents.send('workspace:action', 'showResponse');
    }
    return true;
  });
  handle('overlay:toggle', () => {
    windows.toggleOverlay();
    return true;
  });
  handle('overlay:bar-popover', (event, open) => {
    const window = overlayCaller(event, 'Invalid bar popover request.');
    if (window !== windows.bar() || typeof open !== 'boolean') throw new Error('Invalid bar popover request.');
    windows.setBarPopoverOpen(open);
    return true;
  });
  handle('overlay:expand', (event, expanded) => {
    const window = callers.windowOf(event);
    if (callers.roleOf(event) !== 'overlay' || typeof expanded !== 'boolean')
      throw new Error('Invalid floating assistant request.');
    windows.setOverlayExpanded(window, expanded);
    return true;
  });
  // The panel's corner grip resizes the floating window; sizes are bounded by the main process.
  handle('overlay:resize', (event, size) => {
    const window = overlayCaller(event, 'Invalid floating assistant request.');
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height))
      throw new Error('Invalid floating assistant size.');
    windows.resizeOverlay(window, size.width, size.height);
    return true;
  });
  handle('overlay:close', (event) => {
    const window = overlayCaller(event, 'Invalid floating assistant request.');
    windows.setOverlayExpanded(window, false);
    return true;
  });
}
module.exports = { registerWindows };
