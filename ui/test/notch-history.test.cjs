const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/notch-history.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports });
const { appendNotchInsight, moveNotchInsight, emptyNotchHistory } = moduleValue.exports;

test('new insights preserve an older reading position until navigation reaches latest', () => {
  let state = emptyNotchHistory;
  for (const text of ['First', 'Second', 'Third']) state = appendNotchInsight(state, { id: text, text });
  state = moveNotchInsight(state, -1);
  assert.equal(state.items[state.position].text, 'Second');
  state = appendNotchInsight(state, { id: 'Fourth', text: 'Fourth' });
  assert.equal(state.items[state.position].text, 'Second');
  state = moveNotchInsight(state, 1);
  assert.equal(state.items[state.position].text, 'Third');
  state = moveNotchInsight(state, 1);
  assert.equal(state.position, -1);
  state = appendNotchInsight(state, { id: 'Fifth', text: 'Fifth' });
  assert.equal(state.position, -1);
  assert.equal(state.items.at(-1).text, 'Fifth');
});

test('bounded history keeps the selected insight and ignores blank or repeated updates', () => {
  let state = emptyNotchHistory;
  for (let index = 0; index < 20; index++)
    state = appendNotchInsight(state, { id: String(index), text: `Insight ${index}` });
  for (let index = 0; index < 19; index++) state = moveNotchInsight(state, -1);
  assert.equal(state.position, 0);
  state = appendNotchInsight(state, { id: '20', text: 'Insight 20' });
  assert.equal(state.items.length, 20);
  assert.equal(state.items[state.position].text, 'Insight 0');
  assert.equal(
    state.items.some((item) => item.text === 'Insight 1'),
    false,
  );
  assert.equal(appendNotchInsight(state, { id: 'blank', text: '  ' }), state);
  assert.equal(appendNotchInsight(state, { id: 'again', text: 'Insight 20' }), state);
});
