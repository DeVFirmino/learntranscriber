const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

test('a replayed audio segment returns the stored entry instead of appending again', () => {
  const { db, sessions, entries } = createRepositories(openDatabase(':memory:'));
  try {
    const id = sessions.create('Segments', 'general').id;
    const first = entries.add(id, 'transcript', ' First words ', 'ME', 'segment-1');
    assert.equal(first.content, 'First words');
    assert.deepEqual(
      entries.add(id, 'transcript', 'Replayed words', 'ME', 'segment-1'),
      entries.segment(id, 'segment-1'),
    );
    assert.equal(entries.segment(id, 'segment-1').id, first.id);
    assert.equal(entries.segment(id, 'segment-2'), null);
    assert.equal(sessions.get(id).entries.length, 1);
  } finally {
    db.close();
  }
});
test('entries are validated before anything is written', () => {
  const { db, sessions, entries } = createRepositories(openDatabase(':memory:'));
  try {
    const id = sessions.create('Validation', 'general').id;
    assert.throws(() => entries.add('missing', 'transcript', 'content', 'ME'), /not found/);
    assert.throws(() => entries.add(id, 'system', 'content'), /Invalid entry kind/);
    assert.throws(() => entries.add(id, 'transcript', 'content', 'SOMEONE'), /Invalid speaker/);
    assert.throws(() => entries.add(id, 'transcript', 'content', 'ME', ''), /Invalid audio segment/);
    assert.throws(() => entries.add(id, 'transcript', 'content', 'ME', 'x'.repeat(101)), /Invalid audio segment/);
    assert.throws(() => entries.add(id, 'user', '   '), /valid text/);
    assert.equal(sessions.get(id).entries.length, 0);
  } finally {
    db.close();
  }
});

test('generation entries retain explicit mode and request identity across repository reads', () => {
  const { db, sessions, entries } = createRepositories(openDatabase(':memory:'));
  try {
    const id = sessions.create('Identity', 'general').id;
    for (const [kind, mode, requestId] of [
      ['user', 'chat', 'chat-1'],
      ['assistant', 'insight', 'insight-1'],
      ['assistant', 'screenInsight', 'screen-1'],
      ['assistant', 'chat', 'chat-2'],
    ]) {
      const stored = entries.add(id, kind, 'Content', '', null, { mode, requestId });
      const reloaded = sessions.get(id).entries.find((entry) => entry.id === stored.id);
      assert.equal(reloaded.generation_mode, mode);
      assert.equal(reloaded.request_id, requestId);
    }
    for (const metadata of [
      { mode: 'bad', requestId: 'r' },
      { mode: 'chat', requestId: '' },
      { mode: 'chat', requestId: 'r'.repeat(101) },
    ])
      assert.throws(() => entries.add(id, 'assistant', 'No write', '', null, metadata), /Invalid generation identity/);
    assert.equal(sessions.get(id).entries.length, 4);
  } finally {
    db.close();
  }
});
