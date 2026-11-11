const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { LATEST_VERSION } = require('../src/main/infrastructure/sqlite/migrations/index.cjs');
const {
  BUILT_IN_ASSISTANTS,
  BUILT_IN_IDS,
  LEGACY_DEFAULTS,
  legacyUpgrade,
} = require('../src/main/domain/assistants/built-in-catalog.cjs');

// A workspace written by a build that predates the catalog: version 1, the three legacy rows and one session.
async function legacyWorkspace(t, rows, { selected = 'general', sessionAssistant } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'built-in-catalog-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'workspace.db');
  const first = openDatabase(file);
  first.exec('DELETE FROM assistants');
  first.exec('PRAGMA user_version=1');
  const insert = first.prepare('INSERT INTO assistants(id,name,prompt,category,context) VALUES (?,?,?,?,?)');
  for (const row of rows) insert.run(row.id, row.name, row.prompt, row.category || 'General', row.context || '');
  first.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('assistantId',?)").run(JSON.stringify(selected));
  if (sessionAssistant)
    first
      .prepare("INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('s1','Old session',?,'2026-01-01')")
      .run(sessionAssistant);
  first.close();
  return createRepositories(openDatabase(file));
}

const legacy = (id, overrides = {}) => ({ id, ...LEGACY_DEFAULTS[id], ...overrides });

test('the catalog ships at least five built-ins with unique ids and complete prompts', () => {
  assert.ok(BUILT_IN_ASSISTANTS.length >= 5);
  assert.equal(new Set(BUILT_IN_IDS).size, BUILT_IN_IDS.length);
  for (const assistant of BUILT_IN_ASSISTANTS) {
    assert.ok(assistant.name && assistant.category, assistant.id);
    assert.ok(assistant.prompt.length > 1000, `${assistant.id} has a detailed system prompt`);
    for (const key of ['realtimePrompt', 'followUpPrompt', 'emailPrompt'])
      assert.equal(typeof assistant[key], 'string', `${assistant.id}.${key}`);
    assert.ok(assistant.prompt.length <= 20000 && assistant.realtimePrompt.length <= 20000, assistant.id);
  }
  // The subject assistants share the same prompt section structure.
  for (const id of ['math', 'english', 'programming']) {
    const { prompt } = BUILT_IN_ASSISTANTS.find((assistant) => assistant.id === id);
    for (const section of ['<ROLE>', '<PRINCIPLES>', '<WORKFLOW>', '<FORMAT>', '<CONSTRAINTS>', '<EXAMPLE>'])
      assert.ok(prompt.includes(section), `${id} ${section}`);
  }
});

test('only an untouched legacy row is replaced or retired', () => {
  assert.equal(legacyUpgrade(legacy('general')).action, 'replace');
  assert.equal(legacyUpgrade(legacy('meeting')).assistant.name, 'Note Taker');
  assert.equal(legacyUpgrade(legacy('study')).action, 'retire');
  assert.equal(legacyUpgrade(legacy('general', { prompt: 'Mine.' })).action, 'keep');
  assert.equal(legacyUpgrade(legacy('study', { context: 'My notes.' })).action, 'keep');
  assert.equal(legacyUpgrade(legacy('meeting', { require_certainty: 1 })).action, 'keep');
  assert.equal(legacyUpgrade({ id: 'custom', name: 'General assistant', prompt: 'x' }).action, 'keep');
});

test('upgrading replaces untouched built-ins, retires the study companion and keeps its history', async (t) => {
  const repos = await legacyWorkspace(t, [legacy('general'), legacy('study'), legacy('meeting')], {
    selected: 'study',
    sessionAssistant: 'study',
  });
  try {
    const byId = Object.fromEntries(repos.assistants.all().map((item) => [item.id, item]));
    assert.deepEqual(Object.keys(byId).sort(), [...BUILT_IN_IDS].sort());
    assert.equal(byId.general.name, 'General Assistant');
    assert.equal(byId.meeting.name, 'Note Taker');
    assert.equal(byId.meeting.email_prompt, BUILT_IN_ASSISTANTS.find((a) => a.id === 'meeting').emailPrompt);
    assert.equal(repos.settings.read().assistantId, 'general');
    assert.equal(repos.assistants.forSession('study').name, 'Study companion');
  } finally {
    repos.db.close();
  }
});

test('upgrading keeps edited built-ins and never merges a custom assistant by name', async (t) => {
  const repos = await legacyWorkspace(
    t,
    [
      legacy('general', { prompt: 'My own general prompt.' }),
      legacy('study', { name: 'My study', category: 'Education' }),
      { id: 'mine-1', name: 'Note Taker', prompt: 'My meeting notes.' },
    ],
    { selected: 'study' },
  );
  try {
    const all = repos.assistants.all();
    const byId = Object.fromEntries(all.map((item) => [item.id, item]));
    assert.equal(byId.general.prompt, 'My own general prompt.');
    assert.equal(byId.general.name, 'General assistant');
    assert.equal(byId.study.name, 'My study');
    assert.equal(repos.settings.read().assistantId, 'study');
    assert.equal(byId['mine-1'].prompt, 'My meeting notes.');
    assert.equal(byId.meeting.name, 'Note Taker (2)');
    assert.equal(byId['mine-1'].name, 'Note Taker');
    assert.equal(all.filter((item) => item.name === 'Note Taker').length, 1);
    assert.equal(new Set(all.map((item) => item.name.toLowerCase())).size, all.length);
  } finally {
    repos.db.close();
  }
});

test('reopening a workspace never duplicates built-ins', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'built-in-reopen-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'workspace.db');
  createRepositories(openDatabase(file)).db.close();
  const reopened = createRepositories(openDatabase(file));
  try {
    assert.equal(reopened.assistants.all().length, BUILT_IN_IDS.length);
  } finally {
    reopened.db.close();
  }
  const raw = new DatabaseSync(file);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, LATEST_VERSION);
  raw.close();
});
