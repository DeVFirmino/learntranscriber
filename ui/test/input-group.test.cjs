const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');
const ui = loadTsx('src/components/ui/input-group.tsx', {
  './input-group.css': {},
  './textarea': { Textarea: 'Textarea' },
  cn: { cn: (...parts) => parts.filter(Boolean).join(' ') },
});
test('input group forwards native attributes and keeps textarea and addon contracts', () => {
  const group = ui.InputGroup({ 'aria-label': 'Question', children: 'Content' });
  assert.equal(group.props.role, 'group');
  assert.equal(group.props['aria-label'], 'Question');
  assert.equal(group.props.children, 'Content');
  const ref = { current: null };
  const input = ui.InputGroupTextarea({ ref, value: 'Draft', required: false, name: 'question' });
  assert.equal(input.props.ref, ref);
  assert.equal(input.props.required, false);
  assert.equal(input.props.value, 'Draft');
  assert.equal(ui.InputGroupAddon({ children: 'Send' }).props['data-align'], 'block-end');
  assert.equal(ui.InputGroupAddon({ align: 'block-start', children: 'Image' }).props['data-align'], 'block-start');
});
