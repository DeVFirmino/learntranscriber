// Native UI workflows: setup, ending a session and the saved data. No recording, model call or external write.
const fs = require('node:fs/promises');
const path = require('node:path');
async function run(context, { output, check, wait, eventually, go, click, js, openSession, checks, errors }) {
  const shot = async (name) => {
    await wait(150);
    await fs.writeFile(path.join(output, `${name}.png`), (await context.mainWindow.webContents.capturePage()).toPNG());
  };
  context.saveSettings({ onboardingDismissed: false, onboardingStarted: false, onboardingCompleted: false });
  await go('home');
  check(
    'First use opens the onboarding welcome without commercial onboarding',
    await eventually(() =>
      js(
        `document.body.textContent.includes('Stay with the conversation.') && document.body.textContent.includes('Get started') && !document.body.textContent.includes('Premium')`,
      ),
    ),
  );
  await click('Skip for now', `document.querySelector('[aria-label="Set up your assistant"]')`);
  await wait(300);
  check('Closing the onboarding is persisted', context.repositories.settings.read().onboardingDismissed === true);
  check(
    'The Home setup checklist remains visible after closing onboarding',
    await js(
      `document.body.textContent.includes('Choose an AI model') && document.body.textContent.includes('Set up listening and permissions')`,
    ),
  );
  await click('Review setup');
  check(
    'Setup can be resumed without losing configuration',
    context.repositories.settings.read().onboardingDismissed === false,
  );
  await shot('functional-home');
  const session = context.repositories.sessions.create('Reviewed summary fixture', 'general');
  context.repositories.entries.add(session.id, 'transcript', 'Release after the final review.', 'THEY');
  context.repositories.sessions.update(session.id, { summary: 'Release after review. Keep the queue bounded.' });
  context.setActive(session.id);
  context.changed();
  await openSession(session.id);
  await click('End session');
  check(
    'End session offers to write the summary',
    await js(
      `Boolean([...document.querySelectorAll('[role=dialog] label')].find(n=>n.textContent.includes('Write a summary of the session')))`,
    ),
  );
  await js(`document.querySelector('[role=dialog] [role=checkbox]').click()`);
  await wait(80);
  await click('End session', `document.querySelector('[role=dialog]')`);
  check(
    'The session ends and keeps its existing summary without asking a model',
    (await eventually(() => Boolean(context.repositories.sessions.get(session.id).ended_at))) &&
      context.repositories.sessions.get(session.id).summary === 'Release after review. Keep the queue bounded.',
  );
  await shot('functional-session-ended');
  await go('settings/data');
  check(
    'The data page offers clearing saved history and no email setup',
    await eventually(() =>
      js(
        `document.querySelector('main')?.textContent.includes('Delete saved history') && !document.querySelector('main')?.textContent.includes('email')`,
      ),
    ),
  );
  await shot('functional-data');
  check('Functional workflow has no renderer console errors', errors.length === 0);
  await fs.writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        passed: true,
        checks,
        consoleErrors: errors,
        fixture: 'No real audio, provider inference or external writes',
      },
      null,
      2,
    ),
  );
}
module.exports = { run };
