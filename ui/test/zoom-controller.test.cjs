const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { createZoomController } = loadTs('src/features/shell/zoom-controller.ts');

test('rapid shortcuts apply immediately and persist in order despite intermediate state publications', async () => {
  const applied = [],
    saved = [];
  let finish;
  const controller = createZoomController({
    apply: (level) => applied.push(level),
    save: async (level) => {
      saved.push(level);
      if (level === 110)
        await new Promise((resolve) => {
          finish = resolve;
        });
      controller.sync(level);
    },
    failed: assert.fail,
  });
  await controller.change('in');
  assert.deepEqual(applied, []);
  controller.sync(100);
  controller.change('in');
  const done = controller.change('in');
  assert.deepEqual(applied, [100, 110, 120]);
  await Promise.resolve();
  assert.deepEqual(saved, [110]);
  finish();
  await done;
  assert.deepEqual(saved, [110, 120]);
  assert.equal(applied.at(-1), 120);
});

test('failed persistence restores the saved level and a disposed document is never changed', async () => {
  const applied = [],
    errors = [];
  const controller = createZoomController({
    apply: (level) => applied.push(level),
    save: async () => {
      throw new Error('write failed');
    },
    failed: (error) => errors.push(error),
  });
  controller.sync(120);
  await controller.change('in');
  assert.deepEqual(applied, [120, 130, 120]);
  assert.equal(errors[0].message, 'write failed');
  controller.dispose();
  controller.sync(100);
  await controller.change('reset');
  assert.equal(applied.at(-1), 120);
});
