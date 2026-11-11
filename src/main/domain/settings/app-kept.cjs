// Settings the app keeps for itself and never takes from a settings save: the update check's bookkeeping. A save from
// the renderer could otherwise invent a newer release for the Home banner to announce.
const APP_KEPT = new Set(['updatesLastCheckAt', 'updatesLastRelease', 'updatesSnoozedUntil', 'updatesSkippedTag']);

// The first app-kept key a patch names, if any. A patch that is not an object names none; validation refuses it.
function appKeptKey(patch) {
  if (!patch || typeof patch !== 'object') return undefined;
  return Object.keys(patch).find((key) => APP_KEPT.has(key));
}

module.exports = { appKeptKey };
