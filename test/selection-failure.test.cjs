const { test } = require('node:test');
const assert = require('node:assert/strict');
const { disableSelectionOnFailure } = require('../src/main/application/context/selection-failure.cjs');

test('a failed selection read turns automatic selection off, publishes, then reports', () => {
  const log = [];
  const failed = disableSelectionOnFailure({
    settings: { update: (patch) => log.push(['update', patch]) },
    changed: () => log.push(['changed']),
    report: (message) => log.push(['report', message]),
  });
  failed('Accessibility permission is missing.');
  assert.deepEqual(log, [
    ['update', { autoSelection: false }],
    ['changed'],
    ['report', 'Accessibility permission is missing.'],
  ]);
});
