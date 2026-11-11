const { test } = require('node:test');
const assert = require('node:assert/strict');
const react = require('react');
const { loadTs } = require('./helpers/load-ts.cjs');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

const { firstTryStage, shortcutKeys } = loadTs('src/features/onboarding/first-try.ts');
const { sessionMilestones } = loadTs('src/features/onboarding/progress.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the first session moves from starting to listening, then asking, then done', () => {
  assert.equal(firstTryStage({ transcript: false, answer: false }, false), 'start');
  assert.equal(firstTryStage({ transcript: false, answer: false }, true), 'listen');
  assert.equal(firstTryStage({ transcript: true, answer: false }, true), 'ask');
  assert.equal(firstTryStage({ transcript: true, answer: true }, false), 'done');
  // An answer to a typed question before anything was heard still leaves listening to try.
  assert.equal(firstTryStage({ transcript: false, answer: true }, false), 'start');
});

test('tips show the shortcut the person set, and nothing for one that is off', () => {
  const definitions = [
    { id: 'record', accelerator: 'CommandOrControl+D', enabled: true },
    { id: 'ask', accelerator: 'CommandOrControl+Return', enabled: true },
    { id: 'capture', accelerator: 'CommandOrControl+E', enabled: false },
  ];
  assert.equal(shortcutKeys(definitions, 'record'), '⌘ D');
  assert.equal(shortcutKeys(definitions, 'ask'), '⌘ Enter');
  assert.equal(shortcutKeys(definitions, 'capture'), '');
  assert.equal(shortcutKeys(definitions, 'missing'), '');
});

test('only this session’s own transcript and real answers count as milestones', () => {
  const session = {
    id: 'a',
    entries: [
      { session_id: 'a', kind: 'transcript', content: '  ' },
      { session_id: 'b', kind: 'assistant', content: 'From another session' },
    ],
  };
  assert.deepEqual(plain(sessionMilestones(session)), { transcript: false, answer: false });
  session.entries.push({ session_id: 'a', kind: 'transcript', content: 'Hello' });
  session.entries.push({ session_id: 'a', kind: 'assistant', content: 'An answer' });
  assert.deepEqual(plain(sessionMilestones(session)), { transcript: true, answer: true });
  assert.deepEqual(plain(sessionMilestones(null)), { transcript: false, answer: false });
});

function guide({ onboardingGuide = true, listening = {}, entries = [] } = {}) {
  const calls = [];
  const state = {
    settings: { onboardingGuide },
    overlay: { listening: { active: false, starting: false, since: null, ...listening } },
    shortcutDefinitions: [
      { id: 'record', accelerator: 'CommandOrControl+D', enabled: true },
      { id: 'ask', accelerator: 'CommandOrControl+Return', enabled: true },
    ],
  };
  const api = {
    settings: async (patch) => calls.push(['settings', patch]),
    dispatchShortcut: async (action) => calls.push(['shortcut', action]),
  };
  const mocks = {
    react: {
      ...react,
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect() {},
    },
    './first-try.css': {},
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/use-t.ts': { useT: () => ({ t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key) }) },
    'src/workspace.ts': { useWorkspace: () => ({ state, api, act: (task) => task() }) },
  };
  const session = { id: 's', entries: entries.map((entry) => ({ session_id: 's', ...entry })) };
  return { calls, mocks, session };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('the bar tip says how to start with the current shortcut, and Hide turns the guide off', async () => {
  const { calls, mocks } = guide();
  const { BarGuide } = loadTsx('src/features/onboarding/bar-guide.tsx', mocks);
  const view = BarGuide();
  assert.equal(elements(view, 'p')[0].props.children, 'firstTry.startWithKeys {"keys":"⌘ D"}');
  elements(view, 'button')[0].props.onClick();
  await flush();
  assert.deepEqual(plain(calls), [['settings', { onboardingGuide: false }]]);
});

test('the panel guide follows the session and Finish stops listening before ending the guide', async () => {
  const off = guide({ onboardingGuide: false });
  const { FirstMinuteGuide } = loadTsx('src/features/onboarding/first-minute-guide.tsx', off.mocks);
  assert.equal(FirstMinuteGuide({ session: off.session }), null);

  const heard = guide({ listening: { active: true, since: 1 }, entries: [{ kind: 'transcript', content: 'Hi' }] });
  const asking = loadTsx('src/features/onboarding/first-minute-guide.tsx', heard.mocks).FirstMinuteGuide({
    session: heard.session,
  });
  assert.equal(elements(asking, 'p')[0].props.children, 'firstTry.ask {"keys":"⌘ Enter"}');
  assert.equal(elements(asking, 'Button')[0].props.children, 'firstTry.hide');

  const answered = guide({
    listening: { active: true, since: 1 },
    entries: [
      { kind: 'transcript', content: 'Hi' },
      { kind: 'assistant', content: 'An answer' },
    ],
  });
  const done = loadTsx('src/features/onboarding/first-minute-guide.tsx', answered.mocks).FirstMinuteGuide({
    session: answered.session,
  });
  const finish = elements(done, 'Button')[0];
  assert.equal(finish.props.children, 'firstTry.finish');
  finish.props.onClick();
  await flush();
  assert.deepEqual(plain(answered.calls), [
    ['shortcut', 'toggleRecording'],
    ['settings', { onboardingGuide: false }],
  ]);
});
