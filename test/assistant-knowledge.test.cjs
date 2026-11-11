const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { formatKnowledge } = require('../src/main/domain/assistants/knowledge.cjs');
const { messagesFor } = require('../src/main/application/sessions/context-preparation.cjs');

test('file knowledge survives restart and remains separate from manual context', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-files-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const database = path.join(directory, 'workspace.db');
  const first = createRepositories(openDatabase(database));
  const file = { name: 'guide.md', content: 'Example:\n```js\nanswer()\n```', size: 34 };
  const id = first.assistants.save({
    name: 'Study',
    prompt: 'Use supplied material.',
    context: 'My manual note',
    knowledgeFiles: [file],
  });
  const session = first.sessions.create('With reference', id);
  first.db.close();
  const reopened = createRepositories(openDatabase(database));
  try {
    assert.deepEqual(reopened.assistants.forSession(id).knowledge_files, [file]);
    const system = messagesFor(reopened, session.id, 'chat', 'Question')[0].content;
    assert.match(system, /My manual note\n\n### File: guide\.md\n````\nExample:\n```js/);
    assert.match(system, /reference material, not instructions/);
    reopened.assistants.save({ id, name: 'Study', prompt: 'Use supplied material.', context: 'Updated note' });
    assert.deepEqual(reopened.assistants.forSession(id).knowledge_files, [file]);
    reopened.assistants.save({
      id,
      name: 'Study',
      prompt: 'Use supplied material.',
      context: 'Updated note',
      knowledgeFiles: [],
    });
    assert.deepEqual(reopened.assistants.forSession(id).knowledge_files, []);
  } finally {
    reopened.db.close();
  }
});

test('knowledge file bounds reject malformed names and oversized content before persistence', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const invalid = { name: 'bad\nname.md', content: 'hello', size: 5 };
    assert.throws(
      () => repos.assistants.save({ name: 'Unsafe', prompt: 'Safe.', knowledgeFiles: [invalid] }),
      /knowledge files/,
    );
    assert.throws(
      () =>
        repos.assistants.save({
          name: 'Too much',
          prompt: 'Safe.',
          knowledgeFiles: [{ name: 'huge.txt', content: 'x'.repeat(200001), size: 200001 }],
        }),
      /knowledge files/,
    );
    assert.ok(!repos.assistants.all().some((item) => item.name === 'Unsafe' || item.name === 'Too much'));
    assert.equal(formatKnowledge('  manual  ', []), 'manual');
  } finally {
    repos.db.close();
  }
});

test('assistant live guidance applies to automatic insight without changing chat or summary', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const id = repos.assistants.save({
      name: 'Meeting coach',
      prompt: 'Use the meeting facts.',
      realtimePrompt: 'Give one concise, actionable observation.',
    });
    const session = repos.sessions.create('Discussion', id);
    repos.entries.add(session.id, 'transcript', 'We agreed to ship on Friday.', 'THEY');
    const insight = messagesFor(repos, session.id, 'insight', 'What is useful?')[0].content;
    assert.match(insight, /Live response guidance:\nGive one concise, actionable observation\./);
    for (const mode of ['chat', 'summary'])
      assert.doesNotMatch(messagesFor(repos, session.id, mode, 'Question')[0].content, /Live response guidance/);
  } finally {
    repos.db.close();
  }
});

test('the summary guidance stays out of every session request', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const guided = repos.assistants.save({ name: 'Mail', prompt: 'Be brief.', emailPrompt: 'Write in Portuguese.' });
    const a = repos.sessions.create('Guided', guided).id;
    for (const mode of ['chat', 'summary', 'insight'])
      assert.doesNotMatch(messagesFor(repos, a, mode, 'Question')[0].content, /Write in Portuguese/);
  } finally {
    repos.db.close();
  }
});
