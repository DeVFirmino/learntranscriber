const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

test('a deleted session leaves none of its text in the workspace file', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-delete-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'workspace.sqlite');
  const db = openDatabase(file);
  const { sessions, entries } = createRepositories(db);
  const marker = 'ZebraQuartzConfidentialPlan';
  const session = sessions.create(`${marker} title`, 'general');
  for (let index = 0; index < 50; index++) entries.add(session.id, 'transcript', `${marker} line ${index}`, 'THEY');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  assert.ok(fs.readFileSync(file).includes(marker));
  sessions.delete(session.id);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();
  assert.equal(fs.readFileSync(file).includes(marker), false);
});
