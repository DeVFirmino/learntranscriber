const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');
test('message presentation keeps semantic article markup and distinguishes typed turns from context', () => {
  const { MessageBubble } = loadTsx('src/components/ui/message-bubble.tsx', {
    cn: { cn: (...parts) => parts.filter(Boolean).join(' ') },
  });
  for (const role of ['user', 'assistant', 'context']) {
    const node = MessageBubble({ role, children: 'Message', 'aria-label': role });
    assert.equal(node.type, 'article');
    assert.equal(node.props.role, undefined);
    assert.equal(node.props['data-message-role'], role);
    assert.equal(node.props['aria-label'], role);
    assert.equal(node.props.children, 'Message');
  }
});
