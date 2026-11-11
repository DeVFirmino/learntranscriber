const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const shell = new Proxy({}, { get: (_target, name) => name });
const base = {
  './start-hero.css': {},
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
  'src/components/ui/card.tsx': shell,
  'src/use-t.ts': { useT: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }) },
};

test('completed setup stays collapsed until Review and can be hidden again', () => {
  let reviewing = false;
  const { SetupCard } = loadTsx('src/features/home/setup-card.tsx', {
    ...base,
    react: {
      ...require('react'),
      useState: () => [
        reviewing,
        (value) => {
          reviewing = value;
        },
      ],
    },
    'src/features/getting-started.tsx': { GettingStarted: 'Checklist' },
    'src/features/home/setup-summary.tsx': { SetupSummary: 'Summary' },
  });
  const state = { settings: {} };
  const render = () => SetupCard({ state, progress: { complete: true } });
  assert.equal(elements(render(), 'Checklist').length, 0);
  assert.equal(elements(render(), 'Summary')[0].props.state, state);
  elements(render(), 'Summary')[0].props.onReview();
  assert.equal(elements(render(), 'Checklist').length, 1);
  assert.equal(elements(render(), 'Summary').length, 0);
  elements(render(), 'Button')[0].props.onClick();
  assert.equal(elements(render(), 'Checklist').length, 0);
  assert.equal(elements(SetupCard({ state, progress: { complete: false } }), 'Checklist').length, 1);
});

test('Home starts listening from one primary action and keeps the other actions in its menu', async () => {
  const calls = [];
  const ws = {
    api: { toggleOverlay: async () => calls.push('toggle-floating') },
    act: async (work) => work(),
    audio: { recording: false },
  };
  const { StartHero } = loadTsx('src/features/home/start-hero.tsx', {
    ...base,
    'radix-ui': { DropdownMenu: shell },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/features/home/home-loop.tsx': { HomeLoop: 'Loop' },
    'src/features/home/assistant-menu.tsx': { AssistantMenu: 'AssistantMenu' },
    'src/features/home/live-session.tsx': { LiveClock: 'Clock', LiveControls: 'Controls' },
    'src/features/home/live-session-state.ts': { liveSession: () => null },
    'src/features/home/start-actions.ts': {
      createStartActions: () => ({
        start: async () => calls.push('start'),
        capture: async () => calls.push('capture'),
        ask: async () => calls.push('ask'),
      }),
    },
  });
  const state = { settings: { assistantId: 'general' }, assistants: [{ id: 'general', name: 'General' }] };
  const view = StartHero({ state });
  const primary = elements(view, 'Button').find((element) => element.props.children === 'home.startListening');
  await primary.props.onClick();
  const items = elements(view, 'Item');
  assert.equal(items.length, 3);
  for (const item of items) await item.props.onSelect();
  assert.deepEqual(calls, ['start', 'capture', 'ask', 'toggle-floating']);
  assert.equal(elements(view, 'AssistantMenu')[0].props.state, state);
  assert.equal(elements(view, 'Trigger').length, 1);
  assert.equal(elements(view, 'Content')[0].props.avoidCollisions, true);
  assert.equal(elements(view, 'p').length, 0);
});

test('while a recording runs the Home lead card becomes it: title, clock and controls, menu kept', () => {
  const live = { paused: false, since: 1, session: { id: 's1', title: 'Planning notes' } };
  const { StartHero } = loadTsx('src/features/home/start-hero.tsx', {
    ...base,
    'radix-ui': { DropdownMenu: shell },
    'src/workspace.ts': { useWorkspace: () => ({ api: {}, act: async () => {}, audio: { recording: true } }) },
    'src/features/home/home-loop.tsx': { HomeLoop: 'Loop' },
    'src/features/home/assistant-menu.tsx': { AssistantMenu: 'AssistantMenu' },
    'src/features/home/live-session.tsx': { LiveClock: 'Clock', LiveControls: 'Controls' },
    'src/features/home/live-session-state.ts': { liveSession: () => live },
    'src/features/home/start-actions.ts': { createStartActions: () => ({}) },
  });
  const view = StartHero({ state: { settings: {}, assistants: [] } });
  assert.equal(elements(view, 'h1')[0].props.children, 'Planning notes');
  assert.ok(elements(view, 'p')[0].props.children.includes('home.live'));
  assert.equal(elements(view, 'Controls')[0].props.live, live);
  assert.equal(elements(view, 'Clock')[0].props.since, 1);
  assert.equal(elements(view, 'AssistantMenu').length, 0);
  assert.equal(
    elements(view, 'Button').filter((element) => element.props.children === 'home.startListening').length,
    0,
  );
  assert.equal(elements(view, 'Item').length, 3);
});

test('a recording without a known session titles the card with its state and does not repeat it', () => {
  const { StartHero } = loadTsx('src/features/home/start-hero.tsx', {
    ...base,
    'radix-ui': { DropdownMenu: shell },
    'src/workspace.ts': { useWorkspace: () => ({ api: {}, act: async () => {}, audio: { recording: true } }) },
    'src/features/home/home-loop.tsx': { HomeLoop: 'Loop' },
    'src/features/home/assistant-menu.tsx': { AssistantMenu: 'AssistantMenu' },
    'src/features/home/live-session.tsx': { LiveClock: 'Clock', LiveControls: 'Controls' },
    'src/features/home/live-session-state.ts': { liveSession: () => ({ paused: false, since: 1, session: null }) },
    'src/features/home/start-actions.ts': { createStartActions: () => ({}) },
  });
  const view = StartHero({ state: { settings: {}, assistants: [] } });
  assert.equal(elements(view, 'h1')[0].props.children, 'home.live');
  assert.ok(!elements(view, 'p')[0].props.children.includes('home.live'));
});

test('the Home assistant menu switches the assistant in place and keeps the library one item away', async () => {
  const calls = [];
  const ws = { api: { settings: async (patch) => calls.push(patch) }, act: async (work) => work() };
  const { AssistantMenu } = loadTsx('src/features/home/assistant-menu.tsx', {
    ...base,
    'radix-ui': { DropdownMenu: shell },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/features/assistants/assistant-glyph.tsx': { AssistantGlyph: 'Glyph' },
    'lucide-react': { Check: 'Check', ChevronDown: 'ChevronDown' },
  });
  const state = {
    settings: { assistantId: 'math' },
    assistants: [
      { id: 'general', name: 'General' },
      { id: 'math', name: 'Math' },
    ],
  };
  const view = AssistantMenu({ state });
  assert.match(elements(view, 'Trigger')[0].props['aria-label'], /Math/);
  const items = elements(view, 'Item');
  assert.equal(items.length, 3);
  await items[0].props.onSelect();
  assert.deepEqual(
    calls.map((patch) => ({ ...patch })),
    [{ assistantId: 'general' }],
  );
  assert.equal(elements(view, 'Check').length, 1);
  assert.equal(elements(view, 'a')[0].props.href, '#assistants');
});

test('assistant secondary menu retains build, import and built-in chooser actions', () => {
  const calls = [];
  const { AssistantAddMenu } = loadTsx('src/features/assistants/assistant-add-menu.tsx', {
    ...base,
    'radix-ui': { DropdownMenu: shell },
    'src/workspace.ts': {
      useWorkspace: () => ({ setDialog: (value) => calls.push(value), go: (route) => calls.push(route) }),
    },
  });
  const menu = AssistantAddMenu({ onBuild: () => calls.push('build') });
  const items = elements(menu, 'Item');
  assert.equal(items.length, 3);
  for (const item of items) item.props.onSelect();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), ['build', { type: 'assistant-import' }, 'assistants/choose']);
});

test('the live session is the active recording and the session it writes to, else nothing', () => {
  const { liveSession } = loadTsx('src/features/home/live-session-state.ts', {});
  const sessions = [{ id: 's1', title: 'Planning' }];
  assert.equal(liveSession({ overlay: { listening: { active: false } }, sessions, activeSessionId: 's1' }), null);
  assert.equal(liveSession({ overlay: {}, sessions, activeSessionId: 's1' }), null);
  const live = liveSession({
    overlay: { listening: { active: true, paused: true, since: 5 } },
    sessions,
    activeSessionId: 's1',
  });
  assert.deepEqual({ ...live, session: live.session.id }, { paused: true, since: 5, session: 's1' });
});
