const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { up } = require('../src/main/infrastructure/sqlite/migrations/008-native-audio-selection.cjs');
test('the legacy option labelled Native migrates to native capture while other choices are preserved', () => {
  const db = openDatabase(':memory:');
  try {
    for (const value of ['electron', 'native', 'process-tap', 'input-device']) {
      db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(
        'systemAudioSource',
        JSON.stringify(value),
      );
      up(db);
      assert.equal(
        JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('systemAudioSource').value),
        value === 'electron' ? 'native' : value,
      );
      up(db);
    }
  } finally {
    db.close();
  }
});
