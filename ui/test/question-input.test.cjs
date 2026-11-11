const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { QuestionInput } = loadTsx('src/features/overlay/question-input.tsx', {
  'src/components/ui/input-group.tsx': {
    InputGroup: 'InputGroup',
    InputGroupAddon: 'InputGroupAddon',
    InputGroupTextarea: 'Textarea',
  },
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/ui/send-button.tsx': { SendButton: 'SendButton' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
});
function render(extra = {}) {
  return QuestionInput({
    question: 'Draft',
    onQuestion() {},
    questionRef: { current: null },
    allowed: true,
    required: true,
    busy: false,
    captureDisabled: false,
    onCapture() {},
    attachments: 'Screenshot',
    ...extra,
  });
}
test('composer keeps textarea first in DOM, followed by attachment and action addons', () => {
  const node = render({ required: false });
  assert.equal(node.props.children[0].type, 'Textarea');
  assert.equal(elements(node, 'Textarea')[0].props.required, false);
  const addons = elements(node, 'InputGroupAddon');
  assert.equal(addons[0].props['align'], 'block-start');
  assert.equal(addons[0].props.children, 'Screenshot');
  assert.equal(addons[1].props['align'], 'block-end');
});
test('Enter submits once; Shift+Enter and IME confirmation stay in the field', () => {
  let submits = 0,
    prevented = 0;
  const input = elements(render(), 'Textarea')[0];
  const event = {
    key: 'Enter',
    shiftKey: false,
    nativeEvent: { isComposing: false, keyCode: 13 },
    preventDefault: () => prevented++,
    currentTarget: { form: { requestSubmit: () => submits++ } },
  };
  input.props.onKeyDown(event);
  input.props.onKeyDown({ ...event, shiftKey: true });
  input.props.onKeyDown({ ...event, nativeEvent: { isComposing: true } });
  assert.equal(submits, 1);
  assert.equal(prevented, 1);
  elements(render({ allowed: false }), 'Textarea')[0].props.onKeyDown(event);
  assert.equal(submits, 1);
});
test('capture and cancellation retain their callbacks and disabled states', () => {
  let captures = 0;
  const cancel = () => {};
  const node = render({ busy: true, onCancel: cancel, captureDisabled: true, onCapture: () => captures++ });
  const capture = elements(node, 'Button')[0];
  assert.equal(capture.props.type, 'button');
  assert.equal(capture.props.disabled, true);
  capture.props.onClick();
  assert.equal(captures, 1);
  const send = elements(node, 'SendButton')[0];
  assert.equal(send.props.busy, true);
  assert.equal(send.props.onCancel, cancel);
});
