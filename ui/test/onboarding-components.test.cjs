const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const react = require('react');
const base = {
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/brand.tsx': { BrandMark: 'Mark', BrandName: 'Name' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
};
test('welcome has one start action', () => {
  const calls = [];
  const { OnboardingWelcome } = loadTsx('src/features/onboarding/welcome.tsx', base);
  const props = { busy: false, onStart: () => calls.push('start') };
  const buttons = elements(OnboardingWelcome(props), 'Button');
  buttons[0].props.onClick();
  assert.equal(buttons.length, 1);
  assert.deepEqual(calls, ['start']);
  assert.equal(elements(OnboardingWelcome(props), 'h1')[0].props.children, 'onboardingFlow.welcomeTitle');
  assert.ok(elements(OnboardingWelcome({ ...props, busy: true }), 'Button').every((b) => b.props.disabled));
});
test('surface start saves only its milestone; skipping never completes setup', async () => {
  const state = initialState();
  const calls = [];
  const tasks = [];
  const api = {
    settings: async (patch) => calls.push(patch),
    presentOnboarding: async (active) => calls.push(['onboarding', active]),
    expandOverlay: async (value) => calls.push(['panel', value]),
  };
  const { OnboardingSurface } = loadTsx('src/features/onboarding/surface.tsx', surfaceMocks(state, api, tasks));
  elements(OnboardingSurface({ floating: true }), 'Welcome')[0].props.onStart();
  await Promise.all(tasks);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ onboardingStarted: true, onboardingDismissed: false }]);
  calls.length = 0;
  const skip = elements(OnboardingSurface({ floating: true }), 'Button')[0];
  assert.equal(skip.props.children, 'onboardingFlow.skip');
  skip.props.onClick();
  await Promise.all(tasks);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { onboardingDismissed: true },
    ['onboarding', false],
    ['panel', false],
  ]);
});

function initialState() {
  const { previewSettings } = require('./helpers/load-ts.cjs').loadTs('src/bridge/mock/settings-fixture.ts');
  return {
    settings: previewSettings(),
    credentials: {},
    localModels: { models: [], binaries: {} },
    chatgpt: { accounts: [], activeId: null },
    permissions: {},
    sessions: [],
    privacy: { concealed: false },
    overlay: {},
    activeSessionId: null,
  };
}

function surfaceMocks(state, api, tasks, effects = []) {
  return {
    ...base,
    './welcome.css': {},
    './steps.css': {},
    'src/features/onboarding/demo-step.tsx': { DemoStep: 'DemoStep' },
    'src/features/onboarding/finish-step.tsx': { FinishStep: 'FinishStep' },
    '../overlay/floating-tokens.css': {},
    'src/features/onboarding/listening-setup.tsx': { ListeningSetup: 'ListeningSetup' },
    'src/features/onboarding/permissions-step.tsx': { PermissionsStep: 'PermissionsStep' },
    'src/features/onboarding/welcome.tsx': { OnboardingWelcome: 'Welcome' },
    'src/features/onboarding/ai-step.tsx': { AiStep: 'AiStep' },
    'src/features/onboarding/guide-progress.tsx': { GuideProgress: 'GuideProgress' },
    react: {
      ...react,
      useState: (initial) => [initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useEffect: (run, deps) => effects.push({ run, deps }),
    },
    'src/workspace.ts': {
      useWorkspace: () => ({
        state,
        session: null,
        api,
        act: (task) => {
          const promise = task();
          tasks.push(promise);
          return promise;
        },
      }),
    },
  };
}

for (const floating of [false, true]) {
  test(`unfinished AI setup stays inside the onboarding on the AI step (${floating ? 'floating' : 'workspace'})`, () => {
    const state = initialState();
    state.settings.onboardingStarted = true;
    const effects = [];
    const api = {
      openAiSources: async () => assert.fail('The AI step must not send the person to Settings'),
      settings: async () => assert.fail('Showing the AI step must not mark any step ready'),
    };
    const { OnboardingSurface } = loadTsx('src/features/onboarding/surface.tsx', surfaceMocks(state, api, [], effects));
    const tree = OnboardingSurface({ floating });
    assert.equal(elements(tree, 'AiStep').length, 1);
    assert.equal(elements(tree, 'GuideProgress')[0].props.step, 2);
    for (const effect of effects.filter(({ deps }) => deps.includes('insights'))) effect.run();
    assert.equal(state.settings.onboardingCompleted, false);
  });
}
