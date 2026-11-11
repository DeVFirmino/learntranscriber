const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { bestPlacement } = loadTs('src/features/home/balanced-placement.ts');

const plain = (value) => JSON.parse(JSON.stringify(value));
const cards = [
  { id: 'shortcuts', height: 216 },
  { id: 'stats', height: 194 },
];

test('with setup complete and many sessions the shortcuts move beside the recent list', () => {
  const placement = bestPlacement(
    { main: 420, side: 358, movable: cards, gap: 20 },
    { shortcuts: 'main', stats: 'side' },
  );
  assert.deepEqual(plain(placement), { shortcuts: 'side', stats: 'main' });
});

test('with a long setup checklist and few sessions both movable cards go under the recent list', () => {
  const placement = bestPlacement(
    { main: 240, side: 560, movable: cards, gap: 20 },
    { shortcuts: 'main', stats: 'side' },
  );
  assert.deepEqual(plain(placement), { shortcuts: 'main', stats: 'main' });
});

test('a placement within a small margin of the best one stays, so cards do not hop', () => {
  const current = { shortcuts: 'main', stats: 'side' };
  assert.equal(bestPlacement({ main: 400, side: 390, movable: cards, gap: 20 }, current), current);
});
