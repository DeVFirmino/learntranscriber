const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { onActivationKey } = loadTs('src/features/keyboard-activation.ts');
const press = (handler, key) => {
  let prevented = false;
  handler({ key, preventDefault: () => (prevented = true) });
  return prevented;
};
test('Enter and Space activate like a button and keep the browser from scrolling or submitting', () => {
  let activations = 0;
  const handler = onActivationKey(() => activations++);
  assert.equal(press(handler, 'Enter'), true);
  assert.equal(press(handler, ' '), true);
  assert.equal(activations, 2);
});
test('other keys pass through untouched', () => {
  let activations = 0;
  const handler = onActivationKey(() => activations++);
  for (const key of ['Tab', 'Escape', 'ArrowDown', 'a']) assert.equal(press(handler, key), false);
  assert.equal(activations, 0);
});
