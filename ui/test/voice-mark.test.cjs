const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compiled = ts.transpileModule(fs.readFileSync('src/components/voice-mark.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleValue,
  exports: moduleValue.exports,
  require: (name) => (name.endsWith('.css') ? {} : require(name)),
});
const { VoiceMark } = moduleValue.exports;

test('the shared voice SVG remains decorative and animates only when a response is active', () => {
  const idle = renderToStaticMarkup(React.createElement(VoiceMark));
  const active = renderToStaticMarkup(React.createElement(VoiceMark, { active: true }));
  assert.match(idle, /aria-hidden="true"/);
  assert.match(idle, /focusable="false"/);
  assert.equal((idle.match(/<rect /g) || []).length, 4);
  assert.doesNotMatch(idle, /data-speaking/);
  assert.match(active, /data-speaking="true"/);
});

test('the live wave sets bar geometry through style so its height transition runs', () => {
  const live = renderToStaticMarkup(React.createElement(VoiceMark, { heights: [4, 20, 10, 6] }));
  assert.match(live, /style="height:20px;y:0;/);
  assert.match(live, /style="height:4px;y:8px;/);
});
