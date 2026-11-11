const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

const fields = ['realtime_prompt', 'follow_up_prompt', 'email_prompt'];
test('saving a stored assistant preserves every prompt and its certainty', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const camel = (value) => value.replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
  const input = {
    id: 'roundtrip',
    name: 'Review',
    prompt: 'System task',
    requireCertainty: true,
  };
  for (const field of fields) input[camel(field)] = field + ' instructions';
  repos.assistants.save(input);
  const saved = repos.assistants.all().find((a) => a.id === input.id);
  repos.assistants.save({ ...saved, name: 'Renamed' });
  const updated = repos.assistants.all().find((a) => a.id === input.id);
  for (const field of fields) assert.equal(updated[field], field + ' instructions', field);
  assert.equal(updated.require_certainty, true);
});
test('explicit camelCase clears override stored assistant prompts and certainty', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.assistants.save({
    id: 'clear',
    name: 'Review',
    prompt: 'System',
    followUpPrompt: 'Old',
    requireCertainty: true,
  });
  const saved = repos.assistants.all().find((a) => a.id === 'clear');
  repos.assistants.save({ ...saved, followUpPrompt: '', requireCertainty: false });
  const updated = repos.assistants.all().find((a) => a.id === 'clear');
  assert.equal(updated.follow_up_prompt, '');
  assert.equal(updated.require_certainty, false);
});
test('malformed stored prompt fields are rejected without changing the assistant', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const before = repos.assistants.all().find((a) => a.id === 'general');
  assert.throws(() => repos.assistants.save({ ...before, follow_up_prompt: 17 }), /Invalid assistant field/);
  assert.deepEqual(
    repos.assistants.all().find((a) => a.id === 'general'),
    before,
  );
});
