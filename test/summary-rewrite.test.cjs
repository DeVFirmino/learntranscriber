const test = require('node:test');
const assert = require('node:assert/strict');
const {
  boundedContent,
  summaryRewriteMessages,
  cleanSummaryRewrite,
} = require('../src/main/domain/sessions/summary-rewrite.cjs');

test('overview rewrite keeps both ends of long source material within the recovered budgets', () => {
  const session = {
    title: 'Planning',
    started_at: '2026-10-22',
    assistant_name: 'Meeting notes',
    entries: [
      { kind: 'transcript', speaker: 'ME', content: 'start ' + 'a'.repeat(18000) + ' end' },
      { kind: 'user', content: 'question ' + 'b'.repeat(24000) + ' final' },
    ],
  };
  const messages = summaryRewriteMessages(session, 'Current draft', 'Focus on decisions');
  assert.equal(messages.length, 2);
  assert.match(messages[1].content, /Focus on decisions/);
  assert.match(messages[1].content, /start a/);
  assert.match(messages[1].content, / end/);
  assert.match(messages[1].content, /question b/);
  assert.match(messages[1].content, / final/);
  assert.equal(boundedContent('x'.repeat(30000), 12000).length, 12000);
  assert.match(messages[1].content, /Earlier content omitted for length/);
});

test('overview rewrite removes only a surrounding fence and CONTENT label, rejecting empty output', () => {
  assert.equal(cleanSummaryRewrite('```text\nCONTENT: Supported decision.\n```'), 'Supported decision.');
  assert.equal(cleanSummaryRewrite('Plain overview.'), 'Plain overview.');
  assert.throws(() => cleanSummaryRewrite('```\nCONTENT:\n```'), /empty overview/);
});
