const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const react = require('react');

test('a segmented control renders one tab per segment under its label, with the sliding thumb first', () => {
  const { SegmentedTabsList } = loadTsx('src/components/ui/segmented-tabs.tsx', {
    './segmented-tabs.css': {},
    'radix-ui': { Tabs: { List: 'List', Trigger: 'Trigger' } },
    react: { ...react, useRef: () => ({ current: null }), useLayoutEffect: () => {} },
  });
  const view = SegmentedTabsList({
    value: 'sources',
    label: 'AI',
    segments: [
      { value: 'sources', label: 'Connect AI' },
      { value: 'models', label: 'Choose models' },
    ],
  });
  assert.equal(view.type, 'List');
  assert.equal(view.props['aria-label'], 'AI');
  assert.equal(view.props.children[0].props.className, 'segmented-tabs-thumb');
  assert.deepEqual(
    elements(view, 'Trigger').map((trigger) => [trigger.props.value, trigger.props.children]),
    [
      ['sources', 'Connect AI'],
      ['models', 'Choose models'],
    ],
  );
});

test('the highlight follows resized labels and releases observers and its pending frame', () => {
  const properties = new Map();
  const active = { offsetLeft: 92, offsetWidth: 140 };
  let resize,
    frame,
    cleanup,
    cancelled,
    disconnected = false;
  const observed = [];
  const node = {
    dataset: {},
    querySelector: () => active,
    querySelectorAll: () => [active],
    style: { setProperty: (name, value) => properties.set(name, value) },
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (callback) => {
          frame = callback;
          return 7;
        },
        cancelAnimationFrame: (id) => {
          cancelled = id;
        },
        ResizeObserver: class {
          constructor(callback) {
            resize = callback;
          }
          observe(target) {
            observed.push(target);
          }
          disconnect() {
            disconnected = true;
          }
        },
      },
    },
  };
  const { SegmentedTabsList } = loadTsx('src/components/ui/segmented-tabs.tsx', {
    './segmented-tabs.css': {},
    'radix-ui': { Tabs: { List: 'List', Trigger: 'Trigger' } },
    react: {
      ...react,
      useRef: () => ({ current: node }),
      useLayoutEffect: (effect) => {
        cleanup = effect();
      },
    },
  });
  SegmentedTabsList({ value: 'models', label: 'AI', segments: [] });
  assert.equal(properties.get('--segment-x'), '92px');
  assert.equal(properties.get('--segment-width'), '140px');
  assert.deepEqual(observed, [node, active]);
  assert.equal(node.dataset.placed, undefined);
  frame();
  assert.equal(node.dataset.placed, 'true');
  active.offsetLeft = 110;
  active.offsetWidth = 170;
  resize();
  assert.equal(properties.get('--segment-x'), '110px');
  assert.equal(properties.get('--segment-width'), '170px');
  cleanup();
  assert.equal(cancelled, 7);
  assert.equal(disconnected, true);
});
