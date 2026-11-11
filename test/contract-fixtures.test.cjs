const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/contract-settings-assistants.json');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

const outcome = (fn) => {
  try {
    fn();
    return 'accepts';
  } catch {
    return 'rejects';
  }
};

test('native settings rules match the shared contract fixtures', () => {
  for (const item of fixtures.settings) {
    const repos = createRepositories(openDatabase(':memory:'));
    try {
      assert.equal(
        outcome(() => repos.settings.update(item.patch)),
        item.native,
        item.name,
      );
    } finally {
      repos.db.close();
    }
  }
});

test('native assistant rules match the shared contract fixtures', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    for (const item of fixtures.assistants)
      assert.equal(
        outcome(() => repos.assistants.save(item.input)),
        item.native,
        item.name,
      );
    for (const item of fixtures.deletions)
      assert.equal(
        outcome(() => repos.assistants.delete(item.id)),
        item.native,
        item.name,
      );
  } finally {
    repos.db.close();
  }
});
