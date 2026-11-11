const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const t = (key) => key;
const mocks = {
  '@/use-t': { useT: () => ({ t }) },
  '@/components/ui/button': { Button: 'Button' },
  '@/components/shortcut-keys': { ShortcutKeys: 'ShortcutKeys' },
  '../../use-settings-t': { useSettingsT: () => ({ st: t }) },
};
const { ComposerHeader } = loadTsx('src/features/overlay/composer-header.tsx', mocks);
const { MeetingAudioGuide } = loadTsx('src/settings/tabs/audio/meeting-audio-guide.tsx', mocks);

test('composer minimizes and closes through separate non-submit actions, with a restore action when minimized', () => {
  const events = [];
  const view = ComposerHeader({
    compact: true,
    onToggle: () => events.push('minimize'),
    onClose: () => events.push('close'),
  });
  assert.ok(view.props.className.includes('drag-region'));
  const buttons = elements(view, 'Button');
  assert.equal(buttons[0].props['aria-label'], 'overlay.minimizeComposer');
  for (const button of buttons) {
    assert.equal(button.props.type, 'button');
    button.props.onClick();
  }
  assert.deepEqual(events, ['minimize', 'close']);
  const minimized = ComposerHeader({ compact: true, minimized: true, onToggle() {} });
  assert.equal(elements(minimized, 'Button')[0].props['aria-label'], 'overlay.restoreComposer');
});

test('meeting help offers a native disclosure and actual permission/model configuration destinations', () => {
  const view = MeetingAudioGuide();
  assert.equal(view.type, 'details');
  assert.equal(elements(view, 'summary').length, 1);
  assert.deepEqual(
    elements(view, 'a').map((link) => link.props.href),
    ['#settings/permissions', '#settings/ai'],
  );
  assert.equal(elements(view, 'li').length, 4);
});
