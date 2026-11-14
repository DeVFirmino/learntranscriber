const MIGRATIONS = [
  require('./001-baseline.cjs'),
  require('./002-built-in-catalog.cjs'),
  require('./003-dismissed-built-ins.cjs'),
  require('./004-five-built-ins.cjs'),
  require('./005-drop-connections.cjs'),
  require('./006-drop-email.cjs'),
  require('./007-unique-assistant-names.cjs'),
  require('./008-native-audio-selection.cjs'),
  require('./009-generation-identity.cjs'),
  require('./010-automatic-speech-language.cjs'),
];

// Applies each pending migration in its own transaction; `user_version` records the last one applied.
function migrate(db, transaction, migrations = MIGRATIONS) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (const migration of migrations.filter((item) => item.version > current))
    transaction(db, () => {
      migration.up(db);
      db.exec(`PRAGMA user_version=${migration.version}`);
    });
  return db.prepare('PRAGMA user_version').get().user_version;
}

module.exports = { migrate, MIGRATIONS, LATEST_VERSION: MIGRATIONS.at(-1).version };
