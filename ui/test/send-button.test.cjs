const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
function render(props) {
  const { SendButton } = loadTsx('src/components/ui/send-button.tsx', {
    './send-button.css': {},
    './button': { Button: 'button' },
    cn: { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  return elements(SendButton({ label: 'Send', ...props }), 'button')[0];
}
test('send submits and preserves native keyboard, disabled and positioning props', () => {
  const node = render({ disabled: true, className: 'absolute right-2' });
  assert.equal(node.props.type, 'submit');
  assert.equal(node.props.disabled, true);
  assert.equal(node.props['aria-label'], 'Send');
  assert.match(node.props.className, /absolute right-2/);
});
test('a running request exposes an enabled stop action without submitting again', () => {
  let stopped = 0;
  const node = render({ busy: true, disabled: true, label: 'Stop', onCancel: () => stopped++ });
  assert.equal(node.props.type, 'button');
  assert.equal(node.props.disabled, false);
  assert.equal(node.props['aria-label'], 'Stop');
  node.props.onClick();
  assert.equal(stopped, 1);
});
test('preparation without a cancellable request cannot submit twice', () => {
  assert.equal(render({ busy: true }).props.disabled, true);
});
