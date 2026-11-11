const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatedToolCalls, modelIds } = require('../src/main/domain/providers/model-tools.cjs');

const tools = [{ name: 'lt_tool_0' }];

test('tool calls parse raw arguments and refuse unoffered, oversized or anonymous calls', () => {
  assert.deepEqual(validatedToolCalls([{ id: 'c1', name: 'lt_tool_0', raw: '{"q":"x"}' }], tools, true), [
    { id: 'c1', name: 'lt_tool_0', raw: '{"q":"x"}', arguments: { q: 'x' } },
  ]);
  assert.deepEqual(validatedToolCalls([{ name: 'lt_tool_0', raw: '' }], tools, false)[0].arguments, {});
  assert.throws(() => validatedToolCalls([{ name: 'lt_tool_0', raw: '{' }], tools, false), /invalid tool arguments/);
  assert.throws(() => validatedToolCalls([{ name: 'lt_tool_0', arguments: [] }], tools, false), /Invalid model tool/);
  assert.throws(() => validatedToolCalls([{ name: 'other', arguments: {} }], tools, false), /not offered/);
  assert.throws(() => validatedToolCalls([{ name: 'lt_tool_0', arguments: {} }], tools, true), /no identity/);
});

test('model ids follow each provider list format', () => {
  assert.deepEqual(
    modelIds('chatgpt', {
      models: [
        { slug: 'a', visibility: 'list' },
        { slug: 'b', visibility: 'hidden' },
      ],
    }),
    ['a'],
  );
  assert.deepEqual(modelIds('gemini', { models: [{ name: 'models/gemini-3.5-flash' }] }), ['gemini-3.5-flash']);
  assert.deepEqual(modelIds('openai', { data: [{ id: 'b' }, { id: 7 }, { id: 'a' }] }), ['a', 'b']);
  assert.deepEqual(modelIds('custom', {}), []);
});
