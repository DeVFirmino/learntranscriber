const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { setupProgress } = loadTs('src/features/setup-progress.ts');
// Values built inside the TypeScript loader's context carry its own prototypes; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));
function state(extra = {}) {
  return {
    settings: {
      provider: 'openai',
      model: 'chosen',
      customBaseUrl: '',
      transcriptionProvider: 'openai',
      assistantId: 'general',
      assistantsChosen: true,
    },
    credentials: {},
    localModels: { models: [], binaries: {} },
    chatgpt: { activeId: null, accounts: [] },
    permissions: { microphone: 'denied' },
    assistants: [{ id: 'general', prompt: 'Ground replies in the session.' }],
    ...extra,
  };
}
test('a fresh profile starts with its assistant ready and the model as the next step', () => {
  const progress = setupProgress(state());
  assert.deepEqual(plain(progress.steps.map((step) => [step.key, step.ready])), [
    ['model', false],
    ['audio', false],
    ['assistant', true],
  ]);
  assert.equal(progress.completed, 1);
  assert.equal(progress.remaining, 2);
  assert.equal(progress.complete, false);
  assert.equal(progress.next.key, 'model');
  assert.equal(progress.next.route, '#settings/ai/sources');
});
test('the audio step leads to permissions until the microphone is granted and setup completes in order', () => {
  const s = state();
  s.credentials.openai = true;
  assert.deepEqual(plain(setupProgress(s).next), { key: 'audio', ready: false, route: '#settings/permissions' });
  s.permissions.microphone = 'granted';
  const progress = setupProgress(s);
  assert.equal(progress.steps[1].route, '#settings/general');
  assert.equal(progress.complete, true);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.next, null);
});
test('a profile that has not chosen its built-ins leads the assistant step to the chooser', () => {
  const s = state();
  s.settings.assistantsChosen = false;
  const step = setupProgress(s).steps.find((item) => item.key === 'assistant');
  assert.deepEqual(plain(step), { key: 'assistant', ready: false, route: '#assistants/choose' });
});
