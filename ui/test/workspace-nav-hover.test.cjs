const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

function harness() {
  const states = [];
  const { WorkspaceNav } = loadTsx('src/features/shell/workspace-nav.tsx', {
    react: { useRef: (current) => ({ current }), useEffect: () => {} },
    'src/workspace.ts': { useWorkspace: () => ({ route: 'sessions' }) },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/features/shell/hide-button.tsx': { HideButton: 'HideButton' },
    'src/components/brand-icon.ts': {
      BrandAssistants: 'BrandAssistants',
      BrandHome: 'BrandHome',
      BrandSessions: 'BrandSessions',
      BrandSettings: 'BrandSettings',
    },
  });
  const nav = WorkspaceNav({ page: 'sessions', onPreview: (open) => states.push(open) });
  return { handlers: nav.props, states };
}

test('page focus after a navigation click keeps the rail open until the pointer leaves', () => {
  const { handlers, states } = harness();
  handlers.onPointerEnter({ pointerType: 'mouse' });
  handlers.onFocus();
  handlers.onBlur({ currentTarget: { contains: () => false }, relatedTarget: {} });
  assert.ok(states.every((open) => open === true));
  handlers.onPointerLeave({ currentTarget: { matches: () => false } });
  assert.equal(states.at(-1), false);
});

test('keyboard focus retains the rail after pointer exit, then releases it on blur', () => {
  const { handlers, states } = harness();
  handlers.onFocus();
  handlers.onPointerLeave({ currentTarget: { matches: () => true } });
  assert.deepEqual(states, [true]);
  handlers.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} });
  assert.deepEqual(states, [true]);
  handlers.onBlur({ currentTarget: { contains: () => false }, relatedTarget: {} });
  assert.equal(states.at(-1), false);
});

test('touch pointer entry does not trigger desktop hover expansion', () => {
  const { handlers, states } = harness();
  handlers.onPointerEnter({ pointerType: 'touch' });
  assert.deepEqual(states, []);
});
