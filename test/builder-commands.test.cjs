const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { runCommands } = require('../src/main/domain/assistants/builder-commands.cjs');
const { parseBuilderReply } = require('../src/main/domain/assistants/builder-reply.cjs');
const { applyProposal } = require('../src/main/application/assistants/proposal-actions.cjs');
const { createAppliedProposals } = require('../src/main/application/assistants/applied-proposals.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');

const library = [
  { id: 'general', name: 'General assistant', category: 'General', prompt: 'Help.' },
  {
    id: 'c1',
    name: 'Interview coach',
    category: 'Coaching',
    prompt: 'Ask one question at a time.',
    realtime_prompt: 'Be brief.',
  },
];

test('draft commands edit the unsaved draft with replace, append, aliases and clear', () => {
  const result = runCommands(
    [
      { tool: 'update_assistant_prompt', args: { prompt_type: 'system', content: 'Coach interviews.' } },
      {
        tool: 'update_assistant_prompt',
        args: { prompt_type: 'system', content: 'Ask one question.', strategy: 'append' },
      },
      { tool: 'update_assistant_prompt', args: { prompt_type: 'notch', content: 'Keep it short.' } },
      {
        tool: 'update_assistant_settings',
        args: { assistant_name: 'Interview drill', category: 'Coaching', only_reply_when_certain: true },
      },
      { tool: 'update_assistant_context', args: { content: 'Senior backend roles.' } },
    ],
    {},
    library,
  );
  assert.equal(result.draft.systemPrompt, 'Coach interviews.\n\nAsk one question.');
  assert.equal(result.draft.realtimePrompt, 'Keep it short.');
  assert.equal(result.draft.name, 'Interview drill');
  assert.equal(result.draft.requireCertainty, true);
  assert.equal(result.draft.context, 'Senior backend roles.');
  assert.deepEqual(result.proposals, []);
  assert.equal(
    runCommands([{ tool: 'update_assistant_context', args: { clear: true } }], result.draft, library).draft.context,
    '',
  );
  assert.throws(
    () =>
      runCommands([{ tool: 'update_assistant_prompt', args: { prompt_type: 'system', content: '  ' } }], {}, library),
    /empty/,
  );
  assert.throws(
    () =>
      runCommands([{ tool: 'update_assistant_prompt', args: { prompt_type: 'unknown', content: 'x' } }], {}, library),
    /prompt type/,
  );
  assert.throws(() => runCommands([{ tool: 'update_assistant_context', args: { content: '' } }], {}, library), /clear/);
  assert.throws(() => runCommands(Array(9).fill({ tool: 'finish_assistant_builder' }), {}, library), /too many/);
});
test('library reads run immediately while persistent commands become proposals', () => {
  const result = runCommands(
    [
      { tool: 'search_assistant_library', args: { query: 'interview' } },
      { tool: 'open_assistant_for_editing', args: { assistant_name: 'interview coach' } },
      { tool: 'delete_assistant', args: { assistant_id: 'c1', confirmed: true } },
      { tool: 'finish_assistant_builder', args: {} },
    ],
    {},
    library,
    randomUUID,
  );
  assert.deepEqual(result.results[0].assistants, [{ id: 'c1', name: 'Interview coach', category: 'Coaching' }]);
  assert.equal(result.draft.name, 'Interview coach');
  assert.equal(result.draft.realtimePrompt, 'Be brief.');
  assert.deepEqual(
    result.proposals.map(({ tool, args }) => ({ tool, args })),
    [{ tool: 'delete_assistant', args: { assistant_id: 'c1', confirmed: true } }],
  );
  assert.equal(result.finished, true);
});
test('parser accepts command replies and still accepts full-draft replies', () => {
  const commands = parseBuilderReply(
    JSON.stringify({
      message: 'Drafted.',
      commands: [{ tool: 'update_assistant_settings', args: { assistant_name: 'Notes' } }],
    }),
    {},
    library,
  );
  assert.equal(commands.draft.name, 'Notes');
  assert.deepEqual(commands.proposals, []);
  const legacy = parseBuilderReply(
    JSON.stringify({ message: 'Done.', draft: { name: 'Notes', systemPrompt: 'Summarize.' } }),
    {},
    library,
  );
  assert.equal(legacy.draft.systemPrompt, 'Summarize.');
  assert.deepEqual(legacy.results, []);
});
test('applying proposals reports the real outcome and propagates failures', () => {
  const repos = createRepositories(openDatabase(':memory:')),
    settings = [];
  try {
    assert.throws(
      () => applyProposal(repos.assistants, { tool: 'save_assistant_draft', args: {} }, { name: '', systemPrompt: '' }),
      /name and system/,
    );
    const saved = applyProposal(
      repos.assistants,
      { tool: 'save_assistant_draft', args: {} },
      { name: 'Notes', systemPrompt: 'Summarize.', category: 'Meetings' },
    );
    assert.equal(saved.tool, 'save_assistant_draft');
    assert.equal(repos.assistants.all().find((item) => item.id === saved.id).name, 'Notes');
    const created = applyProposal(repos.assistants, {
      tool: 'create_assistant',
      args: { assistant_name: 'Translator', system_prompt: 'Translate.', category: 'Translation' },
    });
    applyProposal(repos.assistants, {
      tool: 'update_assistant_category',
      args: { assistant_id: created.id, category: 'Writing' },
    });
    assert.equal(repos.assistants.all().find((item) => item.id === created.id).category, 'Writing');
    applyProposal(repos.assistants, {
      tool: 'update_existing_assistant',
      args: { assistant_name: 'translator', new_assistant_name: 'Spanish translator', realtime_prompt: 'Short.' },
    });
    const updated = repos.assistants.all().find((item) => item.id === created.id);
    assert.equal(updated.name, 'Spanish translator');
    assert.equal(updated.realtime_prompt, 'Short.');
    assert.equal(updated.prompt, 'Translate.');
    applyProposal(repos.assistants, { tool: 'use_assistant', args: { assistant_id: created.id } }, null, {
      saveSettings: (patch) => settings.push(patch),
    });
    assert.deepEqual(settings, [{ assistantId: created.id }]);
    assert.throws(
      () => applyProposal(repos.assistants, { tool: 'delete_assistant', args: { assistant_id: created.id } }),
      /Confirm/,
    );
    applyProposal(repos.assistants, { tool: 'delete_assistant', args: { assistant_id: created.id, confirmed: true } });
    assert.equal(
      repos.assistants.all().some((item) => item.id === created.id),
      false,
    );
    assert.throws(
      () =>
        applyProposal(repos.assistants, {
          tool: 'update_assistant_category',
          args: { assistant_id: 'missing', category: 'X' },
        }),
      /not found/,
    );
    assert.throws(() => applyProposal(repos.assistants, { tool: 'update_assistant_prompt', args: {} }), /Unsupported/);
  } finally {
    repos.db.close();
  }
});
test('replaying a proposal token returns the first result instead of creating a duplicate', () => {
  const repos = createRepositories(openDatabase(':memory:')),
    applied = createAppliedProposals();
  try {
    const proposal = runCommands(
      [{ tool: 'create_assistant', args: { assistant_name: 'Translator', system_prompt: 'Translate.' } }],
      {},
      [],
      randomUUID,
    ).proposals[0];
    assert.match(proposal.token, /^[0-9a-f-]{36}$/);
    const before = repos.assistants.all().length;
    applied.issue([proposal]);
    const first = applied.apply(repos.assistants, proposal, null),
      second = applied.apply(repos.assistants, proposal, null);
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.deepEqual(second.result, first.result);
    assert.equal(repos.assistants.all().length, before + 1);
    assert.throws(
      () => applied.apply(repos.assistants, { ...proposal, args: { ...proposal.args, assistant_name: 'Other' } }, null),
      /proposal changed/,
    );
    assert.throws(
      () =>
        applied.apply(
          repos.assistants,
          { tool: 'create_assistant', args: { assistant_name: 'X', system_prompt: 'Y' } },
          null,
        ),
      /Unsupported/,
    );
  } finally {
    repos.db.close();
  }
});
test('an evicted or never-issued proposal token is refused instead of creating a duplicate', () => {
  const repos = createRepositories(openDatabase(':memory:')),
    applied = createAppliedProposals({ limit: 2 });
  try {
    const make = (name) =>
      runCommands(
        [{ tool: 'create_assistant', args: { assistant_name: name, system_prompt: 'Help.' } }],
        {},
        [],
        randomUUID,
      ).proposals[0];
    const first = make('First');
    applied.issue([first]);
    applied.apply(repos.assistants, first, null);
    applied.issue([make('Second'), make('Third')]);
    const count = repos.assistants.all().length;
    assert.throws(() => applied.apply(repos.assistants, first, null), /expired/);
    assert.throws(() => applied.apply(repos.assistants, make('Never issued'), null), /expired/);
    assert.equal(repos.assistants.all().length, count);
  } finally {
    repos.db.close();
  }
});

test('local-model replies with surrounding text, camelCase keys and text booleans still parse', () => {
  const draft = { name: 'PR Reviewer', category: 'Coding', systemPrompt: 'Review pull requests.' };
  const reply = (commands) => JSON.stringify({ message: 'Done', commands }) + '.';
  const settings = parseBuilderReply(
    'Here you go:\n' +
      reply([
        { tool: 'update_assistant_settings', args: { assistantName: 'PR Reviewer', onlyReplyWhenCertain: 'true' } },
      ]),
    draft,
    library,
  );
  assert.equal(settings.draft.requireCertainty, true);
  const created = parseBuilderReply(
    reply([{ tool: 'create_assistant', args: { name: 'PR Reviewer', category: 'Coding', systemPrompt: 'Review.' } }]),
    draft,
    library,
    randomUUID,
  );
  assert.equal(created.proposals[0].args.assistant_name, 'PR Reviewer');
  assert.equal(created.proposals[0].args.system_prompt, 'Review.');
  const deletion = parseBuilderReply(
    reply([{ tool: 'delete_assistant', args: { assistant_id: 'c1', confirmed: 'true' } }]),
    draft,
    library,
    randomUUID,
  );
  assert.equal(deletion.proposals[0].args.confirmed, 'true');
  assert.throws(() => parseBuilderReply('Sorry, no JSON here.', draft, library), /invalid draft/);
});

test('a message-only reply changes nothing and a name passed as an ID still finds the assistant', () => {
  const draft = { name: 'PR Reviewer', category: 'Coding', systemPrompt: 'Review pull requests.' };
  const chat = parseBuilderReply(JSON.stringify({ message: 'Which assistant do you mean?' }), draft, library);
  assert.equal(chat.message, 'Which assistant do you mean?');
  assert.equal(chat.draft.systemPrompt, 'Review pull requests.');
  assert.deepEqual([chat.results, chat.proposals], [[], []]);
  const certain = parseBuilderReply(
    JSON.stringify({
      message: 'Done',
      commands: [{ tool: 'update_assistant_settings', args: { requireCertainty: true } }],
    }),
    draft,
    library,
  );
  assert.equal(certain.draft.requireCertainty, true);
  const opened = parseBuilderReply(
    JSON.stringify({
      message: 'Opened',
      commands: [{ tool: 'open_assistant_for_editing', args: { assistant_id: 'interview coach' } }],
    }),
    draft,
    library,
  );
  assert.equal(opened.draft.name, 'Interview coach');
});
