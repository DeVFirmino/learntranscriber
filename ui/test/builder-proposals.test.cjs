// The builder keeps the proposals still waiting with the new ones (eight at most), changes one proposal's status,
// keeps the last four exchanges, and holds a deletion back until the builder confirmed it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const rules = loadTs('src/features/assistant-builder/builder-proposals.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const proposal = (tool, args = {}) => ({ tool, args, token: 't' });
const item = (id, status) => ({ id, proposal: proposal('save_assistant_draft'), status, note: '' });

test('new proposals join the ones still waiting, and the panel keeps the last eight', () => {
  let next = 10;
  const queued = rules.queueProposals([item(1, 'pending'), item(2, 'done')], [proposal('use_assistant')], () => next++);
  assert.deepEqual(plain(queued.map((entry) => [entry.id, entry.status])), [
    [1, 'pending'],
    [10, 'pending'],
  ]);
  const many = Array.from({ length: 9 }, () => proposal('use_assistant'));
  assert.equal(rules.queueProposals([], many, () => next++).length, 8);
});

test('one proposal changes status, and its note only when one is given', () => {
  const items = [{ ...item(1, 'pending'), note: 'kept' }, item(2, 'pending')];
  const applying = rules.withStatus(items, 1, 'applying');
  assert.equal(applying[0].status, 'applying');
  assert.equal(applying[0].note, 'kept');
  assert.equal(applying[1].status, 'pending');
  assert.equal(rules.withStatus(items, 2, 'error', 'failed')[1].note, 'failed');
});

test('the conversation keeps the last four exchanges', () => {
  let turns = [];
  for (let index = 0; index < 5; index++) turns = rules.withExchange(turns, `q${index}`, `a${index}`);
  assert.equal(turns.length, 8);
  assert.deepEqual(plain(turns[0]), { role: 'user', content: 'q1' });
});

test('a proposal acts on the assistant it names or the draft, and a deletion waits for confirmation', () => {
  assert.equal(rules.proposalTarget(proposal('use_assistant', { assistant_name: 'Notes' }), 'Draft'), 'Notes');
  assert.equal(rules.proposalTarget(proposal('use_assistant', { assistant_id: 'notes' }), 'Draft'), 'notes');
  assert.equal(rules.proposalTarget(proposal('save_assistant_draft'), 'Draft'), 'Draft');
  assert.equal(rules.blockedProposal(proposal('delete_assistant')), true);
  assert.equal(rules.blockedProposal(proposal('delete_assistant', { confirmed: true })), false);
  assert.equal(rules.blockedProposal(proposal('use_assistant')), false);
});
