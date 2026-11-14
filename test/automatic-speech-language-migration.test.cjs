const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { up } = require('../src/main/infrastructure/sqlite/migrations/010-automatic-speech-language.cjs');

test('a saved US English speech language becomes automatic while other choices are preserved', () => {
  const db = openDatabase(':memory:');
  try {
    for (const value of ['en-US', 'pt-BR', 'es-ES', '', 'auto']) {
      db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(
        'appleSpeechLocale',
        JSON.stringify(value),
      );
      up(db);
      assert.equal(
        JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('appleSpeechLocale').value),
        value === 'en-US' ? 'auto' : value,
      );
      up(db);
    }
  } finally {
    db.close();
  }
});

test('the migration leaves an unsaved speech language and other settings alone', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('language', JSON.stringify('en-US'));
    up(db);
    assert.equal(db.prepare('SELECT value FROM settings WHERE key=?').get('appleSpeechLocale'), undefined);
    assert.equal(JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('language').value), 'en-US');
  } finally {
    db.close();
  }
});

test('an existing workspace that saved the old default opens with automatic speech', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
  const { migrate, MIGRATIONS, LATEST_VERSION } = require('../src/main/infrastructure/sqlite/migrations/index.cjs');
  const db = new DatabaseSync(':memory:');
  try {
    migrate(
      db,
      transaction,
      MIGRATIONS.filter((item) => item.version < 10),
    );
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('appleSpeechLocale', JSON.stringify('en-US'));
    assert.equal(migrate(db, transaction), LATEST_VERSION);
    assert.equal(
      JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('appleSpeechLocale').value),
      'auto',
    );
  } finally {
    db.close();
  }
});
