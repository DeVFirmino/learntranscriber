const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, chmodSync } = require('node:fs');
const { dirname } = require('node:path');
const { migrate } = require('./migrations/index.cjs');

// One connection per workspace file; the file and its folder are private to the user. secure_delete overwrites what a
// deletion frees, so a deleted session's transcript and chat do not linger in the file's free pages.
function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;');
  migrate(db, transaction);
  return db;
}

// Synchronous by design: never await inside `action`, and never nest calls on one connection.
function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = action();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { openDatabase, transaction };
