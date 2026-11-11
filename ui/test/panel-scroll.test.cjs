const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
test('a tab measures its own Latest state and its action moves that viewport to the bottom', () => {
  let latest = true;
  const viewport = { scrollTop: 0, scrollHeight: 1000 };
  const { PanelScroll } = loadTsx('src/features/overlay/panel-scroll.tsx', {
    react: {
      useRef: () => ({ current: { querySelector: () => viewport } }),
      useState: () => [
        latest,
        (value) => {
          latest = value;
        },
      ],
    },
    'src/components/ui/scroll-area.tsx': { ScrollArea: 'Scroll' },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
  });
  const render = () => PanelScroll({ follow: false, style: {}, children: 'Tab' });
  assert.equal(elements(render(), 'Button').length, 0);
  elements(render(), 'Scroll')[0].props.onFollowChange(false);
  elements(render(), 'Button')[0].props.onClick();
  assert.equal(viewport.scrollTop, 1000);
  assert.equal(latest, true);
});
