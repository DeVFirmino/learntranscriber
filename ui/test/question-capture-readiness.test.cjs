const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

function input({ ready, quick, busy = false, images = 0 }) {
  const { QuestionForm } = loadTsx('src/features/overlay/question-form.tsx', {
    react: { useRef: (current) => ({ current }), useState: (value) => [value, () => {}] },
    'src/components/ui/border-beam-search.tsx': { BorderBeam: 'Beam' },
    'src/components/model-setup-notice.tsx': { ModelSetupNotice: 'Notice' },
    'src/features/overlay/question-screenshots.tsx': { QuestionScreenshots: 'Screenshots' },
    'src/features/overlay/question-input.tsx': { QuestionInput: 'Input' },
    'src/workspace.ts': {
      useWorkspace: () => ({
        state: {
          settings: { quickScreenshot: quick, provider: 'openai', model: 'selected', customBaseUrl: '' },
          credentials: { openai: ready },
          chatgpt: { accounts: [], activeId: null },
          localModels: { models: [], binaries: {} },
        },
        pendingImages: Array.from({ length: images }),
        requestId: busy ? 'running' : null,
      }),
    },
  });
  return elements(QuestionForm({ question: 'Question', onQuestion() {}, questionRef: { current: null } }), 'Input')[0]
    .props;
}

test('missing AI disables quick capture but allows attachment capture and keeps send disabled', () => {
  assert.equal(input({ ready: false, quick: true }).captureDisabled, true);
  const attachment = input({ ready: false, quick: false });
  assert.equal(attachment.captureDisabled, false);
  assert.equal(attachment.allowed, false);
  assert.equal(input({ ready: true, quick: true }).captureDisabled, false);
});

test('capture keeps busy and attachment-limit guards even when AI is ready', () => {
  assert.equal(input({ ready: true, quick: true, busy: true }).captureDisabled, true);
  assert.equal(input({ ready: false, quick: false, images: 4 }).captureDisabled, true);
});
