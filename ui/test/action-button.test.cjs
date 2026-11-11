const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { ActionButton } = loadTsx('src/components/ui/action-button.tsx', {
  './action-button.css': {},
  './button': { Button: 'Button' },
});

test('primary actions preserve native submit, disabled, busy and event props without duplicating their label', () => {
  const events = [];
  const ref = { current: null };
  const view = ActionButton({
    children: 'Save assistant',
    type: 'submit',
    disabled: true,
    'aria-busy': true,
    ref,
    onClick: () => events.push('click'),
    className: 'w-full',
  });
  assert.equal(view.type, 'Button');
  assert.equal(view.props.type, 'submit');
  assert.equal(view.props.disabled, true);
  assert.equal(view.props['aria-busy'], true);
  assert.equal(view.props.ref, ref);
  assert.ok(view.props.className.includes('w-full'));
  view.props.onClick();
  assert.deepEqual(events, ['click']);
  const spans = elements(view, 'span');
  assert.equal(spans.filter((span) => span.props.children === 'Save assistant').length, 1);
  assert.equal(spans.find((span) => span.props.className === 'action-button-mark').props['aria-hidden'], 'true');
  assert.equal(view.props.children[3].props['aria-hidden'], 'true');
});

test('a contrast action preserves the caller icon, size and dynamic content without changing implicit form behavior', () => {
  const content = { type: 'span', props: { children: 'Saving…' } };
  const view = ActionButton({ children: content, icon: 'plus', tone: 'contrast', size: 'lg' });
  assert.equal(view.props['data-tone'], 'contrast');
  assert.equal(view.props.size, 'lg');
  assert.equal(view.props.type, undefined);
  assert.equal(
    elements(view, 'span').find((span) => span.props.className === 'action-button-mark').props.children,
    'plus',
  );
  assert.equal(
    elements(view, 'span').find((span) => span.props.className === 'action-button-label').props.children,
    content,
  );
});
