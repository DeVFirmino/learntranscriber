const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { ListPagination } = loadTsx('src/components/ui/list-pagination.tsx', {
  '@/use-t': { useT: () => ({ t: (key, values) => key + JSON.stringify(values || {}) }) },
  './button': { Button: 'Button' },
});
const { PaginationFooter } = loadTsx('src/features/sessions/pagination-footer.tsx', {
  '@/components/ui/list-pagination': { ListPagination: 'ListPagination' },
});

test('session pagination converts displayed page requests back to search offsets', () => {
  const picked = [];
  const view = PaginationFooter({ page: 5, pageCount: 7, from: 46, to: 54, total: 58, onPage: (p) => picked.push(p) });
  assert.equal(view.props.page, 6);
  assert.equal(view.props.from, 46);
  view.props.onPage(7);
  assert.deepEqual(picked, [6]);
});

test('later pages remain selectable and the last page disables next', () => {
  const picked = [];
  const view = ListPagination({ page: 7, pageCount: 7, from: 55, to: 58, total: 58, onPage: (p) => picked.push(p) });
  const buttons = elements(view, 'Button');
  assert.equal(buttons.at(-1).props.disabled, true);
  assert.equal(buttons[0].props.disabled, false);
  const current = buttons.find((button) => button.props['aria-current'] === 'page');
  assert.equal(current.props.children, 7);
  buttons[0].props.onClick();
  buttons.find((button) => button.props.children === 6).props.onClick();
  assert.deepEqual(picked, [6, 6]);
});

test('single-page navigation is bounded and empty results omit the footer', () => {
  const props = { page: 1, pageCount: 1, from: 1, to: 1, total: 1, onPage: () => {} };
  const buttons = elements(ListPagination(props), 'Button');
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons.at(-1).props.disabled, true);
  assert.equal(ListPagination({ ...props, total: 0 }), null);
});
