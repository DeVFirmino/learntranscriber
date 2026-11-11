const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

test('selection highlight follows the active item and remeasures when content resizes', () => {
  const style = new Map();
  const selected = { offsetLeft: 120, offsetTop: 4, offsetWidth: 90, offsetHeight: 36 };
  let resize,
    cleanup,
    disconnected = false;
  const observed = [];
  const root = {
    children: [selected],
    querySelector: () => selected,
    style: { setProperty: (key, value) => style.set(key, value) },
    ownerDocument: {
      defaultView: {
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
  const { SelectionTrack } = loadTsx('src/components/ui/selection-track.tsx', {
    './selection-track.css': {},
    react: {
      useCallback: (callback) => callback,
      useRef: () => ({ current: root }),
      useLayoutEffect: (callback) => {
        cleanup = callback();
      },
    },
  });
  const rendered = SelectionTrack({ value: 'display', children: 'controls', 'aria-label': 'Audio options' });
  assert.equal(style.get('--selection-x'), '120px');
  assert.equal(style.get('--selection-width'), '90px');
  selected.offsetWidth = 140;
  resize();
  assert.equal(style.get('--selection-width'), '140px');
  assert.equal(rendered.props['aria-label'], 'Audio options');
  assert.equal(rendered.props.children, 'controls');
  assert.equal(observed.length, 2);
  cleanup();
  assert.equal(disconnected, true);
});

test('selection tracks forward the Radix root ref and its cleanup while retaining their own node', () => {
  const own = { current: null };
  const attached = [];
  let cleaned = false;
  const { SelectionTrack } = loadTsx('src/components/ui/selection-track.tsx', {
    './selection-track.css': {},
    react: { useRef: () => own, useCallback: (callback) => callback, useLayoutEffect: () => {} },
  });
  const node = { role: 'group' };
  const view = SelectionTrack({
    value: 'all',
    children: 'items',
    ref: (value) => {
      attached.push(value);
      return () => {
        cleaned = true;
      };
    },
  });
  const cleanup = view.props.ref(node);
  assert.equal(own.current, node);
  assert.deepEqual(attached, [node]);
  cleanup();
  assert.equal(own.current, null);
  assert.equal(cleaned, true);
  const outer = { current: null };
  const objectRef = SelectionTrack({ value: 'all', ref: outer });
  objectRef.props.ref(node);
  assert.equal(outer.current, node);
  objectRef.props.ref(null);
  assert.equal(outer.current, null);
});
