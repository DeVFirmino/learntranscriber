// US English was the Apple Speech default before automatic English and Portuguese; a saved one moves to automatic.
function up(db) {
  db.prepare(`UPDATE settings SET value='"auto"' WHERE key='appleSpeechLocale' AND value='"en-US"'`).run();
}
module.exports = { version: 10, name: 'automatic-speech-language', up };
