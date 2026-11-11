const { test } = require('node:test');
const assert = require('node:assert/strict');
const react = require('react');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { loadTs } = require('./helpers/load-ts.cjs');
const { en } = loadTs('src/locales/en.ts');
const t = (key, values = {}) =>
  Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), en[key] ?? key);
const base = {
  'src/use-t.ts': { useT: () => ({ t }) },
  'src/components/ui/button.tsx': { Button: 'Button' },
  './demo.css': {},
};

test('assistant selection forwards the chosen example assistant and respects the disabled state', () => {
  const selects = Object.fromEntries(
    ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map((name) => [name, name]),
  );
  const { DemoAssistantSelect } = loadTsx('src/features/onboarding/demo-assistant-select.tsx', {
    ...base,
    'src/components/ui/select.tsx': selects,
  });
  const choices = [];
  const tree = DemoAssistantSelect({ value: 'general', disabled: true, onChange: (id) => choices.push(id) });
  const picker = elements(tree, 'Select')[0];
  assert.equal(picker.props.disabled, true);
  assert.equal(picker.props.value, 'general');
  picker.props.onValueChange('notes');
  assert.deepEqual(choices, ['notes']);
});

test('insight visibility reports the demo once; Continue remains a separate explicit action', () => {
  const effects = [];
  const calls = [];
  const { DemoStep } = loadTsx('src/features/onboarding/demo-step.tsx', {
    ...base,
    'src/features/onboarding/demo-assistant-select.tsx': { DemoAssistantSelect: 'AssistantSelect' },
    'src/features/onboarding/demo-conversation.tsx': { DemoConversation: 'Conversation' },
    'src/components/ui/progress.tsx': { Progress: 'Progress' },
    react: {
      ...react,
      useState: (initial) => {
        const value = typeof initial === 'function' ? initial() : initial;
        if (value?.phase)
          return [{ phase: 'insight', transcript: en['onboardingDemo.phrase'], progress: 100 }, () => {}];
        return [value, () => {}];
      },
      useRef: (current) => ({ current }),
      useEffect: (effect) => effects.push(effect),
      useSyncExternalStore: () => false,
    },
  });
  const tree = DemoStep({
    busy: false,
    onBack: () => {},
    onSeen: () => calls.push('seen'),
    onContinue: () => calls.push('continue'),
  });
  effects.at(-1)();
  effects.at(-1)();
  assert.deepEqual(calls, ['seen']);
  assert.equal(elements(tree, 'AssistantSelect')[0].props.value, 'general');
  elements(tree, 'Button')
    .find((button) => button.props.children[0] === 'Continue')
    .props.onClick();
  assert.deepEqual(calls, ['seen', 'continue']);
});

test('finish controls practice pause, resume and stop without touching the bridge', () => {
  let lesson = 'listening';
  const opened = [];
  const { FinishStep } = loadTsx('src/features/onboarding/finish-step.tsx', {
    ...base,
    react: {
      ...react,
      useState: () => [
        lesson,
        (value) => {
          lesson = value;
        },
      ],
    },
  });
  const render = () =>
    FinishStep({ busy: false, configurationReady: false, onBack: () => {}, onOpen: () => opened.push(true) });
  elements(render(), 'Button')[0].props.onClick();
  assert.equal(lesson, 'paused');
  elements(render(), 'Button')[0].props.onClick();
  assert.equal(lesson, 'listening');
  elements(render(), 'Button')[1].props.onClick();
  assert.equal(lesson, 'stopped');
  assert.equal(elements(render(), 'Button')[0].props.disabled, true);
  elements(render(), 'Button').at(-1).props.onClick();
  assert.deepEqual(opened, [true]);
});
