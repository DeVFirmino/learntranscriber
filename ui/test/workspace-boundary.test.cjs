// A window that fails to render shows why with a way to reload, instead of staying empty, and the failure is logged.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

const reports = [];
const { WorkspaceBoundary } = loadTsx('src/features/shell/workspace-boundary.tsx', {
  '@/bridge': { reportUnhandled: (message) => reports.push(message) },
  '@/components/ui/button': { Button: 'Button' },
  '@/format': { localizeMessage: (text) => `localized: ${text}` },
  '@/i18n': { documentT: (key) => key },
});
const text = (node) => elements(node, 'p').map((paragraph) => paragraph.props.children);

test('a failure keeps its message, and anything that is not an error reads as a failed start', () => {
  assert.equal(WorkspaceBoundary.getDerivedStateFromError(new Error('boom')).error, 'boom');
  assert.equal(WorkspaceBoundary.getDerivedStateFromError('odd').error, 'app.initFailed');
});

test('without a failure the window renders as usual', () => {
  assert.equal(new WorkspaceBoundary({ children: 'workspace' }).render(), 'workspace');
});

test('a failure shows its translated message and a reload button', () => {
  const boundary = new WorkspaceBoundary({ children: 'workspace' });
  boundary.state = { error: 'boom' };
  const view = boundary.render();
  assert.deepEqual(text(view), ['localized: boom']);
  const [reload] = elements(view, 'Button');
  assert.equal(reload.props.children, 'app.reloadWindow');
  assert.equal(typeof reload.props.onClick, 'function');
});

test('the failure goes to the error log with the component it happened in', () => {
  reports.length = 0;
  const boundary = new WorkspaceBoundary({ children: 'workspace' });
  boundary.componentDidCatch(new Error('boom'), { componentStack: '\n    at AnswersView\n    at OverlayPanel' });
  boundary.componentDidCatch('odd', {});
  assert.deepEqual(reports, ['Window render failed: boom (at AnswersView)', 'Window render failed: odd']);
});
