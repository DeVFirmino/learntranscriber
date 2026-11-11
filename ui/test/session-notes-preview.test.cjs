const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

test('choosing a preview note folder persists and publishes the folder used by later saves', async () => {
  let published = 0;
  const ctx = {
    settings: { sessionNotesFolder: '' },
    emit: () => published++,
    requireSession: () => ({ title: 'Review' }),
  };
  const { sessionNotesApi } = loadTs('src/bridge/mock/session-notes.ts', {
    window: {
      setTimeout: (work) => {
        work();
        return 1;
      },
    },
  });
  const notes = sessionNotesApi(ctx);
  assert.match(await notes.sessionNotesFolder(), /Documents/);
  const folder = await notes.chooseSessionNotesFolder();
  assert.equal(ctx.settings.sessionNotesFolder, folder);
  assert.equal(published, 1);
  assert.equal((await notes.saveSessionNote({ sessionId: 's1' })).path, `${folder}/Review.md`);
  ctx.settings.sessionNotesFolder = '';
  assert.match(await notes.sessionNotesFolder(), /Documents/);
});

test('the bar offers a note after stopping, preserves the offer target, and does not treat pause as stop', () => {
  const { loadTsx } = require('./helpers/load-tsx.cjs');
  const values = [];
  let cursor = 0,
    dirty = false;
  const ws = { state: { activeSessionId: 's1', overlay: { listening: { active: false, paused: false } } } };
  const { useSessionNote } = loadTsx('src/features/overlay/use-session-note.ts', {
    react: {
      ...require('react'),
      useEffect: () => {},
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [
          values[index],
          (value) => {
            values[index] = value;
            dirty = true;
          },
        ];
      },
    },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/format.ts': { errorMessage: String },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
  });
  const render = () => {
    let note;
    do {
      dirty = false;
      cursor = 0;
      // eslint-disable-next-line react-hooks/rules-of-hooks -- This fixture replays hook state without a React renderer.
      note = useSessionNote();
    } while (dirty);
    return note;
  };
  assert.equal(render().phase, 'idle');
  ws.state.overlay.listening.active = true;
  assert.equal(render().phase, 'idle');
  ws.state.overlay.listening.paused = true;
  assert.equal(render().phase, 'idle');
  ws.state.overlay.listening.active = false;
  ws.state.activeSessionId = null;
  const offer = render();
  assert.equal(offer.phase, 'ask');
  assert.equal(values[1], 's1');
  offer.dismiss();
  assert.equal(render().phase, 'idle');
  ws.state.activeSessionId = 's2';
  ws.state.overlay.listening.active = true;
  assert.equal(render().phase, 'idle');
});
