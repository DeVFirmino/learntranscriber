// A failed selection read stops the watcher. Automatic selection is turned off so the next publication does not
// start it again, and the user is told why.
function disableSelectionOnFailure({ settings, changed, report }) {
  return (message) => {
    settings.update({ autoSelection: false });
    changed();
    report(message);
  };
}
module.exports = { disableSelectionOnFailure };
