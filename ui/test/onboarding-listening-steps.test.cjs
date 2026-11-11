const { test } = require('node:test');
const assert = require('node:assert/strict');
const react = require('react');
const { loadTs } = require('./helpers/load-ts.cjs');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');

const settings = (patch = {}) => ({ ...previewSettings(), ...patch });
// Values built inside the loaded modules come from another VM context; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness({ patch = {}, credentials = {}, status = {}, speech = {} } = {}) {
  const calls = [];
  const effects = [];
  const state = {
    settings: settings(patch),
    credentials,
    localModels: { models: [], binaries: {} },
    chatgpt: { accounts: [], activeId: null },
    permissions: { microphone: 'not-determined', screen: 'not-determined' },
  };
  const api = {
    settings: async (value) => calls.push(['settings', value]),
    saveKey: async (value) => calls.push(['key', value]),
    requestMicrophone: async () => (calls.push(['requestMicrophone']), false),
    openPrivacyPane: async (name) => calls.push(['pane', name]),
  };
  const mocks = {
    react: {
      ...react,
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useEffect: (run, deps) => effects.push({ run, deps }),
    },
    './listening.css': {},
    './permissions.css': {},
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/switch.tsx': { Switch: 'Switch' },
    'src/settings/settings-icon.tsx': { SettingsIcon: 'Icon' },
    'src/features/onboarding/microphone-check.tsx': { MicrophoneCheck: 'MicrophoneCheck' },
    'src/features/onboarding/ai-key-form.tsx': { AiKeyForm: 'AiKeyForm' },
    'src/features/onboarding/permission-clip.tsx': { PermissionClip: 'PermissionClip' },
    'src/use-t.ts': { useT: () => ({ t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key) }) },
    'src/workspace.ts': { useWorkspace: () => ({ state, api, act: (task) => task() }) },
    'src/settings/tabs/permissions/use-permissions-status.ts': {
      usePermissionsStatus: () => ({
        status: { microphone: false, screen: false, accessibility: false, ...status },
        speech: { authorized: false, denied: false, ...speech },
        refresh: async () => calls.push(['refresh']),
      }),
    },
  };
  return { calls, effects, mocks };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const listening = (mocks) =>
  loadTsx('src/features/onboarding/listening-setup.tsx', mocks).ListeningSetup({
    busy: false,
    onBack() {},
    onContinue() {},
  });

test('the first visit picks computer audio and Apple Speech; a visited step keeps its choices', async () => {
  const fresh = harness({ patch: { onboardingAudioSource: '', transcriptionProvider: 'openai' } });
  listening(fresh.mocks);
  for (const { run } of fresh.effects) run();
  await flush();
  assert.deepEqual(plain(fresh.calls), [
    ['settings', { onboardingAudioSource: 'computer', systemAudio: true, transcriptionProvider: 'apple' }],
  ]);
  const visited = harness({ patch: { onboardingAudioSource: 'microphone', transcriptionProvider: 'openai' } });
  listening(visited.mocks);
  for (const { run } of visited.effects) run();
  await flush();
  assert.deepEqual(visited.calls, []);
});

test('the computer audio switch and the engine chips save at once; Continue waits for transcription and audio', async () => {
  const { calls, mocks } = harness({ patch: { onboardingAudioSource: 'microphone', transcriptionProvider: 'apple' } });
  const view = listening(mocks);
  const [audio] = elements(view, 'Switch');
  assert.equal(audio.props.checked, false);
  audio.props.onCheckedChange(true);
  const engines = elements(view, 'input').filter((input) => input.props.name === 'onboarding-engine');
  assert.deepEqual(
    engines.map((input) => input.props.value),
    ['apple', 'openai', 'gemini'],
  );
  engines[1].props.onChange();
  await flush();
  assert.deepEqual(plain(calls), [
    ['settings', { onboardingAudioSource: 'computer', systemAudio: true }],
    ['settings', { transcriptionProvider: 'openai' }],
  ]);
  assert.equal(elements(view, 'MicrophoneCheck').length, 1);
  assert.equal(elements(view, 'Button').at(-1).props.disabled, false);
  const unpicked = harness({ patch: { onboardingAudioSource: '', transcriptionProvider: 'apple' } });
  assert.equal(elements(listening(unpicked.mocks), 'Button').at(-1).props.disabled, true);
});

test('a cloud engine without its key asks for that key in place instead of continuing', () => {
  const missing = harness({ patch: { onboardingAudioSource: 'microphone', transcriptionProvider: 'gemini' } });
  const view = listening(missing.mocks);
  const [form] = elements(view, 'AiKeyForm');
  assert.deepEqual(plain(form.props.providers), ['gemini']);
  const primary = elements(view, 'Button').at(-1);
  assert.equal(primary.props.children, 'onboardingFlow.saveKey');
  assert.equal(primary.props.disabled, true);
  const saved = harness({
    patch: { onboardingAudioSource: 'microphone', transcriptionProvider: 'gemini' },
    credentials: { gemini: true },
  });
  const ready = listening(saved.mocks);
  assert.equal(elements(ready, 'AiKeyForm').length, 0);
  assert.equal(elements(ready, 'Button').at(-1).props.children[0], 'onboardingFlow.continue');
});

const permissions = (mocks, handlers = {}) =>
  loadTsx('src/features/onboarding/permissions-step.tsx', mocks).PermissionsStep({
    busy: false,
    onBack() {},
    onContinue() {},
    onExample() {},
    ...handlers,
  });

test('permissions are asked one at a time with the pane they live in, and the example stays available', async () => {
  const seen = [];
  const { calls, effects, mocks } = harness({
    patch: { onboardingAudioSource: 'microphone', transcriptionProvider: 'apple' },
    speech: { authorized: true },
  });
  const view = permissions(mocks, { onExample: () => seen.push('example') });
  const rows = elements(view, 'li');
  assert.deepEqual(
    rows.map((row) => row.key),
    ['microphone', 'speech'],
  );
  const pills = elements(view, 'span').filter((span) => span.props.className === 'onboarding-pill');
  assert.deepEqual(
    pills.map((pill) => [pill.props['data-tone'], pill.props.children]),
    [
      ['now', 'onboardingFlow.permissionNeeded'],
      ['done', 'onboardingFlow.allowed'],
    ],
  );
  assert.equal(elements(view, 'PermissionClip')[0].props.need, 'microphone');
  assert.ok(
    effects.some(({ deps }) => deps[0] === 'microphone'),
    'macOS is read again while a permission is missing',
  );
  const buttons = elements(view, 'Button');
  buttons.find((button) => button.props.children === 'onboardingFlow.continueWithExample').props.onClick();
  buttons.at(-1).props.onClick();
  await flush();
  assert.equal(buttons.at(-1).props.children, 'onboardingFlow.allowMicrophone');
  assert.deepEqual(seen, ['example']);
  assert.deepEqual(calls, [['requestMicrophone'], ['pane', 'microphone'], ['refresh']]);
});

test('screen access warns about the reopen, and with everything allowed the step tries it for real', () => {
  const screen = harness({
    patch: { onboardingAudioSource: 'computer', systemAudio: true, transcriptionProvider: 'apple' },
    status: { microphone: true },
    speech: { authorized: true },
  });
  const asking = permissions(screen.mocks);
  assert.equal(elements(asking, 'PermissionClip')[0].props.need, 'screen');
  assert.equal(elements(asking, 'Button').at(-1).props.children, 'onboardingFlow.openSettings');
  assert.ok(elements(asking, 'p').some((p) => p.props.children === 'onboardingFlow.screenRestart'));
  const seen = [];
  const granted = harness({
    patch: { onboardingAudioSource: 'computer', systemAudio: true, transcriptionProvider: 'apple' },
    status: { microphone: true, screen: true },
    speech: { authorized: true },
  });
  const done = permissions(granted.mocks, { onContinue: () => seen.push('real') });
  assert.equal(elements(done, 'PermissionClip').length, 0);
  const primary = elements(done, 'Button').at(-1);
  assert.equal(primary.props.children[0], 'onboardingFlow.tryForReal');
  primary.props.onClick();
  assert.deepEqual(seen, ['real']);
});
