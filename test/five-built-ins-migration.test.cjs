const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { migrate, MIGRATIONS } = require('../src/main/infrastructure/sqlite/migrations/index.cjs');

const dropped = [
  ['system-design', 'System Design Assistant'],
  ['leetcode', 'LeetCode Assistant'],
  ['sales', 'Sales Assistant'],
].map(([id, name]) => ({
  id,
  name,
  prompt: `Seed instructions for ${name}.`,
  category: 'General',
  realtime_prompt: 'Answer briefly.',
  follow_up_prompt: 'Suggest a next step.',
  email_prompt: 'Summarize the conversation.',
}));
const fingerprints = Object.fromEntries(
  dropped.map((row) => [
    row.id,
    createHash('sha256')
      .update(
        JSON.stringify([
          row.name,
          row.prompt,
          row.category,
          row.realtime_prompt,
          row.follow_up_prompt,
          row.email_prompt,
        ]),
      )
      .digest('hex'),
  ]),
);

// A workspace written while the catalog had eight built-ins: version 3 with the three dropped rows as seeded.
async function eightBuiltInWorkspace(
  t,
  { edit, selected, sessionAssistant, useOriginalFingerprints = false, changes = {} },
) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'five-built-ins-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'workspace.db');
  const first = openDatabase(file);
  first.exec('PRAGMA user_version=3');
  const insert = first.prepare(
    'INSERT INTO assistants(id,name,prompt,category,realtime_prompt,follow_up_prompt,email_prompt) VALUES (?,?,?,?,?,?,?)',
  );
  for (const row of dropped) {
    const stored = row.id === edit ? { ...row, prompt: 'My own version.' } : row;
    insert.run(
      stored.id,
      stored.name,
      stored.prompt,
      stored.category,
      stored.realtime_prompt,
      stored.follow_up_prompt,
      stored.email_prompt,
    );
  }
  for (const [column, value] of Object.entries(changes))
    first.prepare(`UPDATE assistants SET ${column}=? WHERE id='sales'`).run(value);
  first.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('assistantId',?)").run(JSON.stringify(selected));
  first
    .prepare("INSERT INTO sessions(id,title,assistant_id,started_at) VALUES ('s1','Old session',?,'2026-01-01')")
    .run(sessionAssistant);
  first.close();
  const reopened = new DatabaseSync(file);
  reopened.exec('PRAGMA foreign_keys=ON');
  migrate(
    reopened,
    transaction,
    MIGRATIONS.map((migration) =>
      migration.version === 4 && !useOriginalFingerprints
        ? { ...migration, up: (db) => migration.up(db, fingerprints) }
        : migration,
    ),
  );
  return createRepositories(reopened);
}

test('untouched copies of the dropped built-ins are retired and their sessions keep the prompt', async (t) => {
  const repos = await eightBuiltInWorkspace(t, { edit: 'sales', selected: 'leetcode', sessionAssistant: 'leetcode' });
  try {
    const ids = repos.assistants.all().map((item) => item.id);
    assert.equal(ids.includes('system-design'), false);
    assert.equal(ids.includes('leetcode'), false);
    assert.equal(repos.settings.read().assistantId, 'general');
    assert.equal(repos.assistants.forSession('leetcode').name, 'LeetCode Assistant');
    assert.equal(repos.assistants.forSession('leetcode').prompt, dropped[1].prompt);
    assert.equal(repos.db.prepare('SELECT COUNT(*) AS count FROM archived_assistants').get().count, 1);
    assert.equal(repos.assistants.all().find((item) => item.id === 'sales').prompt, 'My own version.');
  } finally {
    repos.db.close();
  }
});

test('an edited copy of a dropped built-in stays as the user assistant', async (t) => {
  const repos = await eightBuiltInWorkspace(t, { edit: 'sales', selected: 'sales', sessionAssistant: 'sales' });
  try {
    const sales = repos.assistants.all().find((item) => item.id === 'sales');
    assert.equal(sales.prompt, 'My own version.');
    assert.equal(repos.settings.read().assistantId, 'sales');
  } finally {
    repos.db.close();
  }
});

test('the original retirement fingerprints do not retire synthetic prompt copies', async (t) => {
  const repos = await eightBuiltInWorkspace(t, {
    selected: 'leetcode',
    sessionAssistant: 'leetcode',
    useOriginalFingerprints: true,
  });
  try {
    for (const row of dropped)
      assert.equal(repos.assistants.all().find((item) => item.id === row.id).prompt, row.prompt);
    assert.equal(repos.settings.read().assistantId, 'leetcode');
    assert.equal(repos.db.prepare('SELECT COUNT(*) AS count FROM archived_assistants').get().count, 0);
  } finally {
    repos.db.close();
  }
});

for (const [column, value] of Object.entries({
  context: 'Personal notes.',
  require_certainty: 1,
  knowledge_files: '[{"name":"notes.txt","text":"Private knowledge."}]',
})) {
  test(`a dropped built-in with edited ${column} keeps its selection and session`, async (t) => {
    const repos = await eightBuiltInWorkspace(t, {
      selected: 'sales',
      sessionAssistant: 'sales',
      changes: { [column]: value },
    });
    try {
      const retained = repos.db.prepare("SELECT * FROM assistants WHERE id='sales'").get();
      assert.equal(retained[column], value);
      assert.equal(retained.prompt, dropped[2].prompt);
      assert.equal(repos.settings.read().assistantId, 'sales');
      assert.equal(repos.sessions.get('s1').assistant_id, 'sales');
      assert.equal(repos.db.prepare('SELECT COUNT(*) AS count FROM archived_assistants').get().count, 0);
    } finally {
      repos.db.close();
    }
  });
}
