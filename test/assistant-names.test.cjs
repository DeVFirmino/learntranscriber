const test = require('node:test');
const assert = require('node:assert/strict');
const { assertAvailableName, availableName, nameKey } = require('../src/main/domain/assistants/names.cjs');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { settingsRepository } = require('../src/main/infrastructure/sqlite/settings.cjs');
const { up } = require('../src/main/infrastructure/sqlite/migrations/007-unique-assistant-names.cjs');

test('name admission rejects case, whitespace and Unicode-equivalent duplicates while allowing self edits', () => {
  const library = [{ id: 'one', name: 'General Assistant' }];
  for (const name of ['general assistant', ' General Assistant ', 'Ｇeneral Assistant'])
    assert.throws(() => assertAvailableName(name, 'two', library), /already exists/);
  assert.doesNotThrow(() => assertAvailableName('GENERAL ASSISTANT', 'one', library));
  assert.equal(nameKey(' Ｇeneral Assistant '), 'general assistant');
});

test('name allocation preserves existing suffixes and the storage length limit', () => {
  const name = 'a'.repeat(80);
  const library = [{ name }, { name: name.slice(0, 76) + ' (2)' }];
  const next = availableName(name, library);
  assert.equal(next.length, 80);
  assert.ok(next.endsWith(' (3)'));
});

test('the migration resolves existing duplicates without changing ids, prompts or selection', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO assistants(id,name,prompt) VALUES (?,?,?)').run('one', 'General assistant', 'First prompt');
    db.prepare('INSERT INTO assistants(id,name,prompt) VALUES (?,?,?)').run(
      'two',
      'General Assistant',
      'Second prompt',
    );
    db.prepare('INSERT INTO assistants(id,name,prompt) VALUES (?,?,?)').run(
      'three',
      'General Assistant (2)',
      'Third prompt',
    );
    const settings = settingsRepository({ db, transaction });
    settings.update({ assistantId: 'two' });
    db.prepare(
      "INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('kept','Kept','two','2026-01-01')",
    ).run();
    const before = db.prepare('SELECT id,prompt FROM assistants ORDER BY id').all();
    transaction(db, () => up(db));
    const rows = db.prepare('SELECT id,name,prompt FROM assistants ORDER BY id').all();
    assert.equal(settings.read().assistantId, 'two');
    assert.equal(db.prepare("SELECT assistant_id FROM sessions WHERE id='kept'").get().assistant_id, 'two');
    assert.equal(new Set(rows.map((item) => nameKey(item.name))).size, 3);
    assert.deepEqual(
      rows.map(({ id, prompt }) => ({ id, prompt })),
      before.map(({ id, prompt }) => ({ id, prompt })),
    );
    assert.equal(rows.find((item) => item.id === 'three').name, 'General Assistant (2)');
    const names = rows.map((item) => item.name);
    transaction(db, () => up(db));
    assert.deepEqual(
      db
        .prepare('SELECT name FROM assistants ORDER BY id')
        .all()
        .map((item) => item.name),
      names,
    );
  } finally {
    db.close();
  }
});

test('repository saves and restoring built-ins cannot reintroduce duplicate names', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    assert.throws(() => repos.assistants.save({ name: ' general assistant ', prompt: 'Keep me' }), /already exists/);
    repos.assistants.delete('general');
    const id = repos.assistants.save({ name: 'General Assistant', prompt: 'Custom instructions' });
    repos.assistants.restoreBuiltIns(['general']);
    const library = repos.assistants.all();
    assert.equal(new Set(library.map((item) => nameKey(item.name))).size, library.length);
    assert.equal(library.find((item) => item.id === id).name, 'General Assistant');
    assert.equal(library.find((item) => item.id === id).prompt, 'Custom instructions');
    assert.notEqual(library.find((item) => item.id === 'general').name, 'General Assistant');
  } finally {
    repos.db.close();
  }
});
