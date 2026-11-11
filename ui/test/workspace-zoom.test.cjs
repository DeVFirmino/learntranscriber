const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { loadTs } = require('./helpers/load-ts.cjs');

test('document zoom applies saved settings, respects a shortcut recorder, and cleans up on leaving the workspace', async () => {
  const effects = [],
    writes = [],
    values = new Map();
  const style = {
    setProperty: (key, value) => values.set(key, value),
    removeProperty: (key) => {
      values.delete(key);
      if (key === 'zoom') delete style.zoom;
    },
  };
  let keydown;
  const ws = {
    state: { settings: { workspaceZoom: 120 } },
    api: { settings: async (patch) => writes.push(patch.workspaceZoom) },
    act: assert.fail,
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/features/shell/workspace-zoom.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    document: { documentElement: { style } },
    window: {
      addEventListener: (name, handler, capture) => {
        assert.equal(name, 'keydown');
        assert.notEqual(capture, true, 'the shortcut recorder must get the key before workspace zoom');
        keydown = handler;
      },
      removeEventListener: (name, handler) => {
        assert.equal(name, 'keydown');
        assert.equal(handler, keydown);
      },
    },
    require: (name) => {
      if (name === 'react')
        return { useRef: () => ({ current: null }), useLayoutEffect: (effect) => effects.push(effect) };
      if (name === '@/workspace') return { useWorkspace: () => ws };
      return loadTs(`src/features/shell/${name.slice(2)}.ts`);
    },
  });
  module.exports.WorkspaceZoom();
  const cleanup = effects[0]();
  effects[1]();
  assert.equal(style.zoom, '1.2');
  const event = {
    key: '=',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: true,
    preventDefault: assert.fail,
  };
  keydown(event);
  assert.equal(style.zoom, '1.2');
  keydown({ ...event, defaultPrevented: false, preventDefault: () => {} });
  assert.equal(style.zoom, '1.3');
  await new Promise(setImmediate);
  assert.deepEqual(writes, [130]);
  cleanup();
  assert.equal(style.zoom, undefined);
  assert.equal(values.has('--workspace-zoom'), false);
});
