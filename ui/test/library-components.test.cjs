const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const shell = new Proxy({}, { get: (_target, name) => name });
const base = {
  './library-card.css': {},
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/ui/card.tsx': shell,
  'src/components/ui/badge.tsx': { Badge: 'Badge' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
};

test('library cards keep caller content and data markers in the shared shell', () => {
  const { LibraryCard } = loadTsx('src/components/library-card.tsx', base);
  const card = LibraryCard({
    glyph: 'Glyph',
    title: 'Title',
    menu: 'Menu',
    badges: 'Status',
    footer: 'Actions',
    children: 'Body',
    'data-session-card': true,
  });
  assert.equal(card.props['data-session-card'], true);
  assert.equal(elements(card, 'CardTitle')[0].props.children, 'Title');
  assert.equal(elements(card, 'CardContent')[0].props.children, 'Body');
  assert.equal(elements(card, 'CardFooter')[0].props.children, 'Actions');
  const header = elements(card, 'CardHeader')[0];
  assert.match(JSON.stringify(header), /Glyph.*Title.*Menu.*Status/);
});

test('card menus expose the accessible trigger and retain each item action', () => {
  const calls = [];
  const menu = new Proxy({}, { get: (_target, name) => `Menu.${name}` });
  const { CardMenu } = loadTsx('src/components/card-menu.tsx', { ...base, 'radix-ui': { DropdownMenu: menu } });
  const result = CardMenu({
    label: 'Actions for Planning',
    title: 'Actions',
    items: [{ id: 'delete', label: 'Delete', icon: 'svg', destructive: true, onSelect: () => calls.push('delete') }],
  });
  assert.equal(elements(result, 'Button')[0].props['aria-label'], 'Actions for Planning');
  const item = elements(result, 'Menu.Item')[0];
  item.props.onSelect();
  assert.deepEqual(calls, ['delete']);
  assert.ok(item.props.children.includes('Delete'));
});

test('session rows open the named session and route rename and deletion through review dialogs', async () => {
  const calls = [];
  const ws = {
    act: async (task) => task(),
    openSession: async (id) => calls.push(['open', id]),
    setDialog: (dialog) => calls.push(dialog),
  };
  const { SessionRow } = loadTsx('src/features/sessions/session-row.tsx', {
    ...base,
    'src/components/ui/checkbox.tsx': { Checkbox: 'Checkbox' },
    'src/components/ui/item.tsx': shell,
    'src/components/card-menu.tsx': { CardMenu: 'CardMenu' },
    'src/features/sessions/session-glyph.tsx': { SessionGlyph: 'Glyph' },
    'src/workspace.ts': { useWorkspace: () => ws },
  });
  const session = {
    id: 's1',
    title: 'Planning',
    assistant_id: 'math',
    summary: '',
    started_at: 'invalid-date',
    ended_at: null,
  };
  const row = SessionRow({ session, selecting: false, selected: false, onToggle: () => calls.push('toggle') });
  // The icon is the session's own, so two sessions with the same assistant can look different.
  assert.equal(elements(row, 'Glyph')[0].props.id, 's1');
  const actions = elements(row, 'CardMenu')[0].props.items;
  assert.deepEqual([...actions.map((item) => item.id)], ['open', 'rename', 'delete']);
  actions[0].onSelect();
  actions[1].onSelect();
  actions[2].onSelect();
  await Promise.resolve();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['open', 's1'],
    { type: 'session-rename', id: 's1', title: 'Planning' },
    { type: 'session-delete', ids: ['s1'], title: 'Planning' },
  ]);
  assert.equal(elements(row, 'ItemDescription')[0].props.children, 'sessions.noSummary');
});

test('a selecting session row ticks instead of opening, and an untitled empty one says so', () => {
  const calls = [];
  const { SessionRow } = loadTsx('src/features/sessions/session-row.tsx', {
    ...base,
    'src/components/ui/checkbox.tsx': { Checkbox: 'Checkbox' },
    'src/components/ui/item.tsx': shell,
    'src/components/card-menu.tsx': { CardMenu: 'CardMenu' },
    'src/features/sessions/session-glyph.tsx': { SessionGlyph: 'Glyph' },
    'src/workspace.ts': { useWorkspace: () => ({ act: async () => calls.push('open') }) },
  });
  const session = {
    id: 's2',
    title: 'Conversation · 11/2/2026',
    untitled: true,
    entry_count: 0,
    summary: '',
    started_at: '2026-11-02T16:08:00.000Z',
    ended_at: '2026-11-02T16:20:00.000Z',
  };
  const row = SessionRow({ session, selecting: true, selected: true, onToggle: () => calls.push('toggle') });
  assert.equal(elements(row, 'CardMenu').length, 0);
  const box = elements(row, 'Checkbox')[0];
  assert.equal(box.props.checked, true);
  const title = elements(row, 'button')[0];
  title.props.onClick();
  assert.deepEqual(calls, ['toggle']);
  assert.equal(title.props.children, 'sessions.untitled');
  assert.equal(elements(row, 'ItemDescription')[0].props.children, 'sessions.nothingRecorded');
});

test('session groups retain headings, card selection and toggle actions for each day', () => {
  const toggled = [];
  const rows = [{ id: 's1' }, { id: 's2' }];
  const { SessionGroups } = loadTsx('src/features/sessions/session-groups.tsx', {
    ...base,
    react: {
      ...require('react'),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    },
    'src/use-t.ts': { useT: () => ({ t: (key) => key, language: 'en' }) },
    './session-list.css': {},
    'src/features/sessions/session-row.tsx': { SessionRow: 'SessionRow' },
    'src/features/sessions/session-display.ts': {
      groupByDay: () => [
        { day: 'today', date: '2026-11-03', sessions: [rows[0]] },
        { day: 'yesterday', date: '2026-11-02', sessions: [rows[1]] },
      ],
    },
  });
  const result = SessionGroups({
    rows,
    selecting: true,
    selected: new Set(['s2']),
    onToggle: (id) => toggled.push(id),
  });
  assert.deepEqual(
    elements(result, 'section').map((node) => node.props['aria-label']),
    ['sessions.today', 'sessions.yesterday'],
  );
  const cards = elements(result, 'SessionRow');
  assert.deepEqual(
    cards.map((card) => card.props.selected),
    [false, true],
  );
  assert.ok(cards.every((card) => card.props.selecting));
  cards[1].props.onToggle();
  assert.deepEqual(toggled, ['s2']);
});
