const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

test('attached context is trimmed, ordered and refused for a missing session or blank text', () => {
  const { db, sessions, contextItems } = createRepositories(openDatabase(':memory:'));
  try {
    const id = sessions.create('Context', 'general').id;
    const first = contextItems.add(id, ' selection ', ' Release checklist ');
    contextItems.add(id, 'screen', 'Dashboard text');
    assert.deepEqual(
      sessions.get(id).context.map((item) => [item.id === first, item.source, item.content]),
      [
        [true, 'selection', 'Release checklist'],
        [false, 'screen', 'Dashboard text'],
      ],
    );
    assert.throws(() => contextItems.add('missing', 'selection', 'text'), /not found/);
    assert.throws(() => contextItems.add(id, 'selection', '  '), /valid text/);
    assert.equal(sessions.get(id).context.length, 2);
  } finally {
    db.close();
  }
});
