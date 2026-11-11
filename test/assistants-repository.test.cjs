const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { settingsRepository } = require('../src/main/infrastructure/sqlite/settings.cjs');
const { assistantRepository, seedBuiltInAssistants } = require('../src/main/infrastructure/sqlite/assistants.cjs');
const { BUILT_IN_IDS } = require('../src/main/domain/assistants/built-in-catalog.cjs');

function open() {
  const db = openDatabase(':memory:');
  seedBuiltInAssistants(db);
  const settings = settingsRepository({ db, transaction });
  return { db, settings, assistants: assistantRepository({ db, transaction, settings }) };
}

test('seeding restores missing built-ins with their categories and keeps edits to them', () => {
  const { db, assistants } = open();
  try {
    assistants.save({ id: 'general', name: 'Edited general', prompt: 'Mine.' });
    seedBuiltInAssistants(db);
    const byId = Object.fromEntries(assistants.all().map((item) => [item.id, item]));
    assert.deepEqual(Object.keys(byId).sort(), [...BUILT_IN_IDS].sort());
    assert.equal(byId.general.name, 'Edited general');
    assert.equal(byId.math.category, 'Education');
    assert.equal(byId.meeting.category, 'Meetings');
    assert.equal(byId.programming.category, 'Education');
    assert.equal(byId.math.require_certainty, false);
  } finally {
    db.close();
  }
});
test('a deleted built-in stays deleted when the seed runs again, and unknown ids are refused', () => {
  const { db, settings, assistants } = open();
  try {
    settings.update({ assistantId: 'math' });
    assert.deepEqual(assistants.delete('math'), { selectedAssistantId: 'general' });
    assert.equal(settings.read().assistantId, 'general');
    seedBuiltInAssistants(db);
    assert.equal(
      assistants.all().some((item) => item.id === 'math'),
      false,
    );
    assert.equal(assistants.all().length, BUILT_IN_IDS.length - 1);
    assert.throws(() => assistants.delete(''), /Choose an assistant/);
    assert.throws(() => assistants.delete('missing'), /Assistant not found/);
  } finally {
    db.close();
  }
});
test('the last assistant cannot be deleted, and the selection moves to the first one left', () => {
  const { db, settings, assistants } = open();
  try {
    settings.update({ assistantId: 'general' });
    assistants.delete('general');
    const [first, ...rest] = assistants.all().map((item) => item.id);
    assert.equal(settings.read().assistantId, first);
    for (const id of rest) assistants.delete(id);
    assert.throws(() => assistants.delete(first), /Keep at least one assistant/);
    assert.deepEqual(
      assistants.all().map((item) => item.id),
      [first],
    );
  } finally {
    db.close();
  }
});
test('deleting the selected assistant falls back to general and archives it for its sessions', () => {
  const { db, settings, assistants } = open();
  try {
    const id = assistants.save({ name: 'Interviewer', prompt: 'Ask follow-ups.' });
    settings.update({ assistantId: id });
    db.prepare("INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('s1','Kept',?,'2026-01-01')").run(id);
    assert.deepEqual(assistants.delete(id), { selectedAssistantId: 'general' });
    assert.equal(settings.read().assistantId, 'general');
    assert.equal(
      assistants.all().some((item) => item.id === id),
      false,
    );
    assert.equal(assistants.forSession(id).name, 'Interviewer');
    assert.equal(assistants.forSession('never-existed'), null);
  } finally {
    db.close();
  }
});
test('deleting an unselected assistant without sessions keeps the selection and archives nothing', () => {
  const { db, settings, assistants } = open();
  try {
    const id = assistants.save({ name: 'Scratch', prompt: 'Temporary.' });
    settings.update({ assistantId: 'math' });
    assert.deepEqual(assistants.delete(id), { selectedAssistantId: 'math' });
    assert.equal(assistants.forSession(id), null);
  } finally {
    db.close();
  }
});
