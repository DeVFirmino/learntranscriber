const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { planBuiltInChoice } = require('../src/main/domain/assistants/built-in-choice.cjs');
const { createBuiltInChoice } = require('../src/main/application/assistants/built-in-choice.cjs');
const { BUILT_IN_IDS } = require('../src/main/domain/assistants/built-in-catalog.cjs');

const catalogIds = ['general', 'math', 'english'];

test('the plan restores chosen built-ins that are missing and removes stored ones that were not chosen', () => {
  assert.deepEqual(planBuiltInChoice({ catalogIds, libraryIds: ['general', 'math', 'mine'], chosenIds: ['english'] }), {
    restore: ['english'],
    remove: ['general', 'math'],
  });
  assert.deepEqual(planBuiltInChoice({ catalogIds, libraryIds: ['general'], chosenIds: ['general'] }), {
    restore: [],
    remove: [],
  });
});

test('the plan refuses unknown ids and an empty library', () => {
  assert.throws(() => planBuiltInChoice({ catalogIds, libraryIds: [], chosenIds: ['nope'] }), /from the catalog/);
  assert.throws(() => planBuiltInChoice({ catalogIds, libraryIds: [], chosenIds: 'general' }), /from the catalog/);
  assert.throws(() => planBuiltInChoice({ catalogIds, libraryIds: ['general'], chosenIds: [] }), /Keep at least one/);
});

test('choosing applies the plan, survives a reseed, records the choice and publishes once', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  let changes = 0;
  const choice = createBuiltInChoice({
    assistants: repos.assistants,
    recordChoice: () => repos.settings.update({ assistantsChosen: true }),
    changed: () => changes++,
  });
  repos.settings.update({ assistantId: 'general' });
  choice.choose(['math', 'english']);
  const ids = () =>
    repos.assistants
      .all()
      .map((item) => item.id)
      .sort();
  assert.deepEqual(ids(), ['english', 'math']);
  assert.equal(repos.settings.read().assistantId, 'english');
  assert.equal(repos.settings.read().assistantsChosen, true);
  assert.equal(changes, 1);
  choice.choose([...BUILT_IN_IDS]);
  assert.deepEqual(ids(), [...BUILT_IN_IDS].sort());
});
