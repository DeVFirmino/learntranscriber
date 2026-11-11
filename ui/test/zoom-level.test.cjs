const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { nextWorkspaceZoom, workspaceZoomAction } = loadTs('src/features/shell/zoom-level.ts');

test('workspace zoom moves in exact ten-percent steps, clamps, and resets', () => {
  assert.equal(nextWorkspaceZoom(100, 'in'), 110);
  assert.equal(nextWorkspaceZoom(120, 'out'), 110);
  assert.equal(nextWorkspaceZoom(150, 'in'), 150);
  assert.equal(nextWorkspaceZoom(70, 'out'), 70);
  assert.equal(nextWorkspaceZoom(150, 'reset'), 100);
  assert.equal(nextWorkspaceZoom(NaN, 'in'), 110);
  let level = 70;
  for (let i = 0; i < 8; i++) level = nextWorkspaceZoom(level, 'in');
  assert.equal(level, 150);
});

test('only Command with equals, plus, minus or zero adjusts workspace zoom', () => {
  const event = { metaKey: true, ctrlKey: false, altKey: false };
  for (const [key, expected] of [
    ['=', 'in'],
    ['+', 'in'],
    ['-', 'out'],
    ['0', 'reset'],
    ['d', null],
  ])
    assert.equal(workspaceZoomAction({ ...event, key }), expected);
  assert.equal(workspaceZoomAction({ ...event, key: '=', metaKey: false }), null);
  assert.equal(workspaceZoomAction({ ...event, key: '=', altKey: true }), null);
  assert.equal(workspaceZoomAction({ ...event, key: '=', ctrlKey: true }), null);
});
