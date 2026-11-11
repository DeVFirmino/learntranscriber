const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { focusNewPage } = loadTs('src/features/page-focus.ts');

function page({ heading = true, holds = [] } = {}) {
  const focused = [];
  const target = (name) => ({ name, focus: (options) => focused.push([name, { ...options }]) });
  const title = heading ? target('title') : null;
  const main = {
    ...target('main'),
    contains: (node) => node === main || holds.includes(node),
    querySelector: (selector) => (selector === 'h1[tabindex="-1"]' ? title : null),
  };
  return { main, focused };
}

test('after a page change focus moves to the new page title without scrolling', () => {
  const { main, focused } = page();
  focusNewPage(main, { name: 'nav link' });
  assert.deepEqual(focused, [['title', { preventScroll: true }]]);
});

test('a page without a focusable title focuses the main area instead', () => {
  const { main, focused } = page({ heading: false });
  focusNewPage(main, null);
  assert.deepEqual(focused, [['main', { preventScroll: true }]]);
});

test('focus that the new page already took, like the chat box, stays where it is', () => {
  const chat = { name: 'chat box' };
  const { main, focused } = page({ holds: [chat] });
  focusNewPage(main, chat);
  focusNewPage(main, main);
  focusNewPage(null, { name: 'nav link' });
  assert.deepEqual(focused, []);
});
