const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createTranscriptionJobs } = require('../src/main/application/audio/transcription-jobs.cjs');

test('a replayed segment returns its stored transcript instead of appending twice', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const id = repos.sessions.create('Meeting', 'general').id;
    const first = repos.entries.add(id, 'transcript', 'We picked a bounded queue.', 'THEY', 'segment-1');
    const replay = repos.entries.add(id, 'transcript', 'We picked a bounded queue.', 'THEY', 'segment-1');
    assert.equal(replay.id, first.id);
    assert.equal(repos.sessions.get(id).entries.filter((entry) => entry.kind === 'transcript').length, 1);
    repos.entries.add(id, 'transcript', 'Another sentence.', 'THEY', 'segment-2');
    repos.entries.add(id, 'transcript', 'No segment id.', 'ME');
    assert.equal(repos.sessions.get(id).entries.length, 3);
    assert.throws(() => repos.entries.add(id, 'transcript', 'x', 'ME', ''), /Invalid audio segment/);
    assert.equal(repos.entries.segment(id, 'segment-2').content, 'Another sentence.');
  } finally {
    repos.db.close();
  }
});
test('ending a session drains accepted segments and refuses new ones until it resumes', async () => {
  const jobs = createTranscriptionJobs(),
    order = [];
  let release;
  const accepted = jobs.run(
    's1',
    () =>
      new Promise((resolve) => {
        release = () => {
          order.push('accepted saved');
          resolve('text');
        };
      }),
  );
  const closing = jobs.close('s1').then(() => order.push('ended'));
  await assert.rejects(
    jobs.run('s1', async () => 'late'),
    /no longer active/,
  );
  release();
  assert.equal(await accepted, 'text');
  await closing;
  assert.deepEqual(order, ['accepted saved', 'ended']);
  jobs.open('s1');
  assert.equal(await jobs.run('s1', async () => 'after resume'), 'after resume');
});
