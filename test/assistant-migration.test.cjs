const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { messagesFor } = require('../src/main/application/sessions/context-preparation.cjs');

test('legacy assistants and session references survive expanded assistant persistence', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-migration-')),
    file = path.join(directory, 'workspace.db');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(file);
  legacy.exec(
    "CREATE TABLE assistants (id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL); INSERT INTO assistants VALUES ('general','Original name','Original instructions')",
  );
  legacy.close();
  const repos = createRepositories(openDatabase(file));
  const session = repos.sessions.create('Before migration', 'general');
  assert.equal(repos.assistants.all().find((item) => item.id === 'general').prompt, 'Original instructions');
  assert.equal(repos.assistants.all().find((item) => item.id === 'general').category, 'General');
  assert.equal(repos.assistants.all().find((item) => item.id === 'math').category, 'Education');
  repos.assistants.save({
    id: 'general',
    name: 'Updated name',
    prompt: 'Answer from evidence.',
    category: 'Research',
    realtimePrompt: 'Short spoken reply.',
    followUpPrompt: 'Suggest questions.',
    emailPrompt: 'Summarize.',
    context: 'A retained reference fact.',
    requireCertainty: true,
  });
  repos.db.close();
  const reopened = createRepositories(openDatabase(file));
  try {
    const assistant = reopened.assistants.all().find((item) => item.id === 'general');
    assert.equal(reopened.sessions.get(session.id).assistant_id, 'general');
    assert.equal(assistant.category, 'Research');
    assert.equal(assistant.follow_up_prompt, 'Suggest questions.');
    assert.equal(assistant.require_certainty, true);
    const system = messagesFor(reopened, session.id, 'chat', 'Question')[0].content;
    assert.match(system, /A retained reference fact/);
    assert.match(system, /do not guess/);
  } finally {
    reopened.db.close();
  }
});
