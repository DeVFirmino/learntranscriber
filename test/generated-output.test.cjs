const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { persistGeneratedOutput } = require('../src/main/application/sessions/generated-output.cjs');

test('a generated summary never overwrites an overview saved while it was generating', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Planning', 'general');
  const atStart = repos.sessions.get(session.id);
  repos.sessions.updateSummary(session.id, 'Manual overview written meanwhile.', '');
  assert.throws(
    () => persistGeneratedOutput(repos, atStart, 'summary', 'Generated overview.'),
    /changed while the summary was generating/,
  );
  assert.equal(repos.sessions.get(session.id).summary, 'Manual overview written meanwhile.');
});
test('an unchanged overview receives the generated summary; other modes keep their targets', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const session = repos.sessions.create('Planning', 'general');
  assert.equal(persistGeneratedOutput(repos, repos.sessions.get(session.id), 'summary', 'Generated overview.'), null);
  assert.equal(repos.sessions.get(session.id).summary, 'Generated overview.');
  assert.equal(persistGeneratedOutput(repos, repos.sessions.get(session.id), 'translation', 'Tradução.'), null);
  assert.equal(repos.sessions.get(session.id).translation, 'Tradução.');
  const entry = persistGeneratedOutput(repos, repos.sessions.get(session.id), 'chat', 'An answer.', 'chat-request');
  assert.equal(repos.sessions.get(session.id).entries.find((item) => item.id === entry.id).content, 'An answer.');
});
