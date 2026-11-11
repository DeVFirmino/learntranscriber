// The system events the windows and privacy follow: waking from sleep reapplies privacy, a crashed GPU or utility
// process reaches the windows, and a display that changes or goes away brings the windows back on screen.
function composeSystemEvents({ electron: { powerMonitor, app, screen }, windows, privacy, settings, changed }) {
  powerMonitor.on('resume', () => {
    privacy.update(settings());
    changed();
  });
  app.on('child-process-gone', (_event, details) => windows.childGone(details));
  const recoverBounds = () => windows.recoverBounds();
  screen.on('display-removed', recoverBounds);
  screen.on('display-metrics-changed', recoverBounds);
}
module.exports = { composeSystemEvents };
