const { writeFileAtomic } = require('../infrastructure/files/atomic-file.cjs');
const { createScreenCapture } = require('../application/context/screen-capture.cjs');
const { createContextCapture } = require('../application/context/capture.cjs');
const { jpegDataUrl, CAPTURE_IMAGE } = require('../application/context/screenshot-image.cjs');
const { createSessionExport } = require('../application/sessions/export.cjs');
const { sessionMarkdown } = require('../domain/sessions/markdown-export.cjs');
const { sessionExportDestination } = require('../infrastructure/files/session-export.cjs');
const { registerDesktop } = require('../interface/ipc/desktop.cjs');

// Wires screen capture, context capture, the desktop helpers and the Markdown session export to their IPC
// channels.
function composeDesktop({
  handle,
  sessions,
  active,
  capture,
  screenshot,
  nativeContext,
  desktop,
  electron,
  broadcast,
}) {
  const { dialog, BrowserWindow } = electron;
  registerDesktop(handle, {
    capture,
    captureImage: createScreenCapture({
      captureImage: async () => jpegDataUrl(await screenshot(), CAPTURE_IMAGE),
      changed: (value) => broadcast('screen:capture-state', value),
    }).capture,
    context: createContextCapture({ active, nativeContext, screenshot }),
    desktop,
    exports: createSessionExport({
      sessions: { markdown: (id) => sessionMarkdown(sessions.get(id)) },
      destination: sessionExportDestination({ dialog, BrowserWindow, writeFileAtomic }),
    }),
  });
}
module.exports = { composeDesktop };
