const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { loadTs } = require('./helpers/load-ts.cjs');
const { elements } = require('./helpers/load-tsx.cjs');

function mount(follow, geometry = {}, onFollowChange) {
  const viewport = { scrollTop: 0, scrollHeight: 2000, clientHeight: 400, firstElementChild: {}, ...geometry };
  let resize,
    disconnected = false,
    refs = 0;
  const effects = [];
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/ui/scroll-area.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      constructor(callback) {
        resize = callback;
      }
      observe(child) {
        assert.ok(child === viewport || child === viewport.firstElementChild);
      }
      disconnect() {
        disconnected = true;
      }
    },
    require: (name) => {
      if (name === '@/features/scroll-following') return loadTs('src/features/scroll-following.ts');
      if (name === 'react')
        return {
          useRef: (value) => ({ current: ++refs === 1 ? viewport : value }),
          useEffect: (effect) => effects.push(effect),
        };
      if (name === 'radix-ui') return { ScrollArea: { Root: 'Root', Viewport: 'Viewport' } };
      if (name === 'cn') return { cn: (...values) => values.join(' ') };
      return require(name);
    },
  });
  const rendered = module.exports.ScrollArea({ follow, children: 'Answer', onFollowChange });
  const cleanup = effects[0]();
  return {
    viewport,
    events: elements(rendered, 'Viewport')[0].props,
    resize: () => resize?.(),
    cleanup,
    observed: () => Boolean(resize),
    disconnected: () => disconnected,
  };
}

test('auto-scroll follows growing answers, pauses when reading history, and resumes at the bottom', () => {
  const f = mount(true);
  f.resize();
  assert.equal(f.viewport.scrollTop, 2000);
  f.events.onWheel({ deltaY: -100, currentTarget: f.viewport });
  f.viewport.scrollTop = 600;
  f.events.onScroll({ currentTarget: f.viewport });
  f.viewport.scrollHeight = 2400;
  f.resize();
  assert.equal(f.viewport.scrollTop, 600);
  f.viewport.scrollTop = 2000;
  f.events.onScroll({ currentTarget: f.viewport });
  f.viewport.scrollHeight = 2600;
  f.resize();
  assert.equal(f.viewport.scrollTop, 2600);
  f.cleanup();
  assert.equal(f.disconnected(), true);
});

test('turning auto-scroll off leaves the user in control of scroll position', () => {
  const f = mount(false);
  assert.equal(f.observed(), true);
  f.resize();
  assert.equal(f.viewport.scrollTop, 0);
});

test('each mounted tab reports actual overflow even when automatic following is disabled', () => {
  const changes = [];
  const long = mount(false, {}, (value) => changes.push(value));
  assert.equal(changes.at(-1), false);
  const short = mount(false, { scrollHeight: 200, clientHeight: 400 }, (value) => changes.push(value));
  assert.equal(changes.at(-1), true);
  short.events.onWheel({ deltaY: -100, currentTarget: short.viewport });
  assert.equal(changes.at(-1), true);
  assert.equal(long.viewport.scrollTop, 0);
});

test('resize clears Latest on short content and exposes it when non-followed content grows', () => {
  const changes = [];
  const f = mount(false, { scrollHeight: 200, clientHeight: 400 }, (value) => changes.push(value));
  f.viewport.scrollHeight = 1400;
  f.resize();
  assert.equal(changes.at(-1), false);
  f.viewport.scrollHeight = 200;
  f.resize();
  assert.equal(changes.at(-1), true);
});
