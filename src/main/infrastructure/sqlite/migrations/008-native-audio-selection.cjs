// The UI labelled the browser route as Native; preserve that selection's intended native capture.
function up(db) {
  db.prepare(`UPDATE settings SET value='"native"' WHERE key='systemAudioSource' AND value='"electron"'`).run();
}
module.exports = { version: 8, name: 'native-audio-selection', up };
