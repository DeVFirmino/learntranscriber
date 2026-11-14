// Focused native acceptance: state fixtures only. No microphone, system audio, inference or external tools run.
const fs = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');
const { globalShortcut } = require('electron');
const { BAR_POPOVER_HEIGHT } = require('./domain/windows/layout.cjs');
async function run(context, { output, check, ready, wait, eventually, checks, errors }) {
  const { mainWindow: main, repositories, dispatchShortcut, saveSettings } = context;
  const js = (window, code) => window.webContents.executeJavaScript(code, true);
  const state = () => js(main, 'window.workspace.state()');
  const screenshot = async (window, name) => {
    await wait(150);
    await fs.writeFile(path.join(output, `${name}.png`), (await window.webContents.capturePage()).toPNG());
  };
  await js(main, `document.querySelector('[aria-label="Close setup"]')?.click()`);
  await wait(150);
  check(
    'Session controls are reviewed after leaving onboarding',
    repositories.settings.read().onboardingDismissed === true,
  );
  saveSettings({ provider: 'custom', model: 'fixture-model', customBaseUrl: 'http://127.0.0.1:9/v1' });
  const session = repositories.sessions.create('Behavior review fixture', 'general');
  repositories.entries.add(
    session.id,
    'transcript',
    'Could you walk me through the rollout plan for next week?',
    'THEY',
  );
  context.setActive(session.id);
  context.changed();
  dispatchShortcut('ask');
  const find = (surface) =>
    [...context.privacy.windows.keys()].find((w) => w.webContents.getURL().includes(`surface=${surface}`));
  const bar = find('bar'),
    panel = find('panel');
  await ready(bar);
  await ready(panel);
  for (const window of [bar, panel])
    window.webContents.on('console-message', (details) => {
      if (details.level === 'error') errors.push(details.message);
    });
  await js(
    main,
    `window.workspace.reportError({message:'Native system audio could not start (The user declined TCCs for application, window, display capture).',forward:true,notice:{permission:'screen'}})`,
  );
  check(
    'Capture permission feedback belongs to one panel and offers System Settings',
    await eventually(async () => {
      const counts = await Promise.all(
        [main, panel, bar].map((window) => js(window, `document.querySelectorAll('[data-sonner-toast]').length`)),
      );
      const action = await js(panel, `document.querySelector('[data-sonner-toast] [data-button]')?.textContent`);
      return counts[0] === 0 && counts[1] === 1 && counts[2] === 0 && action === 'Open System Settings';
    }),
  );
  await screenshot(panel, 'capture-permission-hint');
  await js(panel, `document.querySelector('[data-sonner-toast] [data-close-button]')?.click()`);
  await js(
    panel,
    `(()=>{
    const input=document.querySelector('textarea[name="question"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Shortcut submission fixture');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
    input.form.addEventListener('submit',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      window.reviewQuestionSubmitted=true;
    },{capture:true,once:true});
  })()`,
  );
  check(
    'A typed floating question enables Send without an extra action',
    await eventually(() => js(panel, `!document.querySelector('button[type="submit"]').disabled`)),
  );
  dispatchShortcut('ask');
  check(
    'The native Ask shortcut submits the focused question form',
    await eventually(() => js(panel, `window.reviewQuestionSubmitted===true`)),
  );
  await js(
    panel,
    `(()=>{
    const input=document.querySelector('textarea[name="question"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.blur();
  })()`,
  );
  // Closing first-use setup starts the bar's launch intro; wait for the real control before measuring it.
  for (let i = 0; i < 200 && !(await js(bar, `Boolean(document.querySelector('[aria-label="Start listening"]'))`)); i++)
    await wait(25);
  check(
    'Start listening uses the chosen icon-only 36px graphite control with blue brand accent',
    await eventually(() =>
      js(
        bar,
        `(()=>{const button=document.querySelector('[aria-label="Start listening"]');if(!button)return false;const box=button.getBoundingClientRect();const accent=button.querySelector('svg > :last-child');return box.width===36&&box.height===36&&button.textContent.trim()===''&&getComputedStyle(accent).stroke==='rgb(37, 129, 255)';})()`,
      ),
    ),
  );
  // Command-E belongs to the floating assistant: the screenshot waits in its Session tab, ready to send, and the
  // workspace window is never brought forward.
  saveSettings({ quickScreenshot: false });
  const mainWasVisible = main.isVisible();
  const restoreCapture = context.setCapture(() => bar.webContents.capturePage());
  try {
    dispatchShortcut('capture');
    check(
      'Command-E attaches the screenshot in the floating Session tab, ready to send, without showing the workspace',
      await eventually(
        async () =>
          main.isVisible() === mainWasVisible &&
          (await js(
            panel,
            `(()=>{const shot=document.querySelector('[aria-label="Attached screenshots"] img');const send=document.querySelector('[aria-label="Send"]');return Boolean(shot)&&Boolean(send)&&!send.disabled;})()`,
          )),
      ),
    );
    await screenshot(panel, 'floating-capture');
    await js(panel, `document.querySelector('[aria-label^="Remove screenshot"]')?.click()`);
  } finally {
    restoreCapture();
  }
  // The capture notice holds the picker's place for three seconds, longer than one eventually() window.
  for (
    let i = 0;
    i < 200 &&
    !(await js(
      bar,
      `Boolean(document.querySelector('[role="combobox"][aria-label="Assistant for the next session"]'))`,
    ));
    i++
  )
    await wait(25);
  await screenshot(bar, 'bar-idle');
  const pickerBounds = bar.getBounds();
  bar.focus();
  await wait(100);
  await js(bar, `document.querySelector('[role="combobox"][aria-label="Assistant for the next session"]').click()`);
  check(
    'The assistant picker has room inside its native window and shows up to three distinct assistants',
    await eventually(async () => {
      const bounds = bar.getBounds();
      return (
        bounds.height === pickerBounds.height + BAR_POPOVER_HEIGHT &&
        bounds.y + bounds.height === pickerBounds.y + pickerBounds.height &&
        (await js(
          bar,
          `(()=>{const labels=[...document.querySelectorAll('[data-assistant-option]')].map(item=>item.textContent.trim());return labels.length>1&&labels.length<=3&&new Set(labels).size===labels.length;})()`,
        ))
      );
    }),
  );
  await wait(250);
  check(
    'The assistant picker stays open after the native resize settles',
    await js(
      bar,
      `document.querySelector('[role="combobox"]').getAttribute('aria-expanded')==='true' && document.querySelectorAll('[role="option"]').length>1`,
    ),
  );
  await screenshot(bar, 'assistant-picker');
  const firstPage = await js(bar, `document.querySelector('.assistant-picker-page')?.textContent || ''`);
  await js(bar, `document.querySelector('[aria-label="Next assistants"]').click()`);
  check(
    'Next assistants turns the picker page and keeps it open with up to three assistants',
    await eventually(() =>
      js(
        bar,
        `(()=>{const page=document.querySelector('.assistant-picker-page')?.textContent||'';const count=document.querySelectorAll('[data-assistant-option]').length;return page!==${JSON.stringify(firstPage)}&&page.startsWith('Page 2')&&count>0&&count<=3&&document.querySelector('[role="combobox"]').getAttribute('aria-expanded')==='true';})()`,
      ),
    ),
  );
  await screenshot(bar, 'assistant-picker-next');
  await js(bar, `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))`);
  check(
    'Closing the assistant picker restores the compact native bar',
    await eventually(() => bar.getBounds().height === pickerBounds.height),
  );
  // Only the focused bar sees Command, and a blur while it is held resets the hold, so the bar gets focus back first.
  bar.focus();
  await eventually(() => js(bar, 'document.hasFocus()'));
  await js(bar, `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Meta',metaKey:true}))`);
  check(
    'Holding Command shows the shortcut sheet with the real keys in a grown bar window',
    await eventually(async () => {
      const bounds = bar.getBounds();
      return (
        bounds.height === pickerBounds.height + BAR_POPOVER_HEIGHT &&
        (await js(
          bar,
          `(()=>{const sheet=document.querySelector('.shortcut-sheet');return Boolean(sheet)&&sheet.querySelectorAll('.shortcut-sheet-row').length>=4&&sheet.textContent.includes('D');})()`,
        ))
      );
    }),
  );
  await screenshot(bar, 'shortcut-sheet');
  await js(bar, `window.dispatchEvent(new KeyboardEvent('keyup',{key:'Meta'}))`);
  check(
    'Releasing Command hides the sheet and restores the compact bar',
    await eventually(
      async () =>
        bar.getBounds().height === pickerBounds.height &&
        !(await js(bar, `Boolean(document.querySelector('.shortcut-sheet'))`)),
    ),
  );
  await js(bar, `document.querySelector('[data-shortcuts-key]').click()`);
  check(
    'The bar shortcut key opens the shortcut sheet without holding Command',
    await eventually(() => js(bar, `Boolean(document.querySelector('.shortcut-sheet'))`)),
  );
  await js(bar, `document.querySelector('[data-shortcuts-key]').click()`);
  check(
    'Clicking the shortcut key again closes the sheet and restores the compact bar',
    await eventually(
      async () =>
        bar.getBounds().height === pickerBounds.height &&
        !(await js(bar, `Boolean(document.querySelector('.shortcut-sheet'))`)),
    ),
  );
  check('Escape is registered while the floating bar is visible', globalShortcut.isRegistered('Escape'));
  saveSettings({ overlayOpacity: 0.65 });
  dispatchShortcut('hide');
  await wait(60);
  dispatchShortcut('hide');
  check(
    'Repeated hide shortcut fades the panel without concealing it',
    !context.privacy.concealed && panel.getOpacity() < 0.9,
  );
  await wait(290);
  check(
    'Held shortcut restores opaque text while preserving the frame opacity setting',
    Math.abs(panel.getOpacity() - 1) < 0.01 && repositories.settings.read().overlayOpacity === 0.65,
  );
  dispatchShortcut('hide');
  await wait(100);
  check('A hide tap waits before concealing', !context.privacy.concealed);
  check(
    'A hide tap eventually conceals and releases Escape',
    await eventually(() => context.privacy.concealed && !globalShortcut.isRegistered('Escape')),
  );
  dispatchShortcut('hide');
  check('Hidden windows restore immediately', !context.privacy.concealed && bar.isVisible());
  await js(main, "location.hash='settings/audio'");
  check(
    'Audio settings keep the assistant shortcuts registered',
    await eventually(() => globalShortcut.isRegistered('CommandOrControl+E')),
  );
  await js(main, "location.hash='settings/shortcuts'");
  check(
    'The shortcut editor suspends global keys during rebinding',
    await eventually(
      () => !globalShortcut.isRegistered('Escape') && !globalShortcut.isRegistered('CommandOrControl+B'),
    ),
  );
  await js(main, "location.hash='home'");
  check(
    'Leaving the shortcut editor restores visible-bar Escape',
    await eventually(() => globalShortcut.isRegistered('Escape')),
  );
  await js(main, 'window.workspace.reportListening(true, false, false)');
  check(
    'Recording uses a compact timer and separate pause and stop controls',
    await eventually(() =>
      js(
        bar,
        `Boolean(document.querySelector('[role="timer"]')?.textContent.trim().match(/^\\d{2}:\\d{2}$/) && document.querySelector('[aria-label="Pause audio capture"]') && document.querySelector('[aria-label="Stop listening"]'))`,
      ),
    ),
  );
  await screenshot(bar, 'bar-recording');
  await js(bar, 'window.workspace.expandOverlay(false)');
  check(
    'Collapsed recording bar renders prompt and pause/source controls, without a tools selector',
    await eventually(() =>
      js(
        bar,
        `Boolean(document.querySelector('[data-bar-prompt] input') && !document.querySelector('[data-bar-prompt] select') && document.querySelector('[aria-label="Pause audio capture"]') && document.querySelector('[aria-label="Audio sources"]'))`,
      ),
    ),
  );
  const before = (await state()).overlay.listening;
  await screenshot(bar, 'bar-listening');
  const beforeQuestionRoute = await js(main, 'location.hash');
  const mainVisibleBeforeQuestion = main.isVisible();
  let automaticCaptures = 0;
  const restoreQuestionCapture = context.setCapture(() => {
    automaticCaptures++;
    throw new Error('Question opening must not capture the screen.');
  });
  try {
    let submittedRequests = 0;
    const pendingResponses = [];
    const questionServer = createServer((request, response) => {
      request.resume();
      submittedRequests++;
      pendingResponses.push(response);
    });
    await new Promise((resolve) => questionServer.listen(0, '127.0.0.1', resolve));
    try {
      saveSettings({ customBaseUrl: `http://127.0.0.1:${questionServer.address().port}/v1` });
      await wait(100);
      await js(
        bar,
        `(()=>{const input=document.querySelector('[data-bar-prompt] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Explain the rollout');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()})()`,
      );
      bar.focus();
      await wait(100);
      bar.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      bar.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
      bar.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      check(
        'Enter in the bar submits directly and shows Session without a second composer',
        await eventually(
          async () =>
            submittedRequests === 1 &&
            panel.isVisible() &&
            (await js(
              panel,
              'Boolean(document.querySelector("[data-session-panel]"))&&!document.querySelector("[data-compact-question]")',
            )),
        ),
      );
      check(
        'A direct bar question takes no screenshot and preserves the workspace and listening state',
        automaticCaptures === 0 &&
          main.isVisible() === mainVisibleBeforeQuestion &&
          (await js(main, 'location.hash')) === beforeQuestionRoute &&
          (await state()).overlay.listening.active,
      );
      const first = pendingResponses.shift();
      first.writeHead(200, { 'content-type': 'text/event-stream' });
      first.end(
        'data: ' +
          JSON.stringify({ choices: [{ delta: { content: 'The bar question was answered directly.' } }] }) +
          '\n\ndata: [DONE]\n\n',
      );
      check(
        'The direct bar answer is saved and shown in the floating Session',
        await eventually(() =>
          js(panel, `document.body.textContent.includes('The bar question was answered directly.')`),
        ),
      );
      await js(bar, `window.workspace.openQuestion('A second question')`);
      check(
        'The global question composer still opens independently',
        await eventually(() =>
          js(panel, `document.querySelector('[data-compact-question] textarea')?.value==='A second question'`),
        ),
      );
      submittedRequests = 0;
      await wait(100);
      await js(
        panel,
        `(()=>{window.reviewInvalid=0;document.addEventListener('invalid',()=>window.reviewInvalid++,true)})()`,
      );
      panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', modifiers: ['meta'] });
      dispatchShortcut('ask');
      check(
        'Command-Enter submits once and keeps the floating window visible above other windows',
        await eventually(() => panel.isVisible() && panel.isAlwaysOnTop() && submittedRequests === 1),
      );
      dispatchShortcut('ask');
      check(
        'Repeated Command-Enter on the cleared busy field shows no native validation popup',
        submittedRequests === 1 &&
          (await js(panel, 'window.reviewInvalid===0 && document.querySelector("[data-question-box]").noValidate')),
      );
      for (const response of pendingResponses) {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end(
          'data: ' +
            JSON.stringify({ choices: [{ delta: { content: 'A readable answer stays in the floating panel.' } }] }) +
            '\n\ndata: [DONE]\n\n',
        );
      }
      check(
        'The floating panel keeps the completed answer visible',
        await eventually(() =>
          js(panel, `document.body.textContent.includes('A readable answer stays in the floating panel.')`),
        ),
      );
    } finally {
      questionServer.closeAllConnections();
      await new Promise((resolve) => questionServer.close(resolve));
    }
    saveSettings({ overlayOpacity: 0.44, unifiedModalFontScale: 0.7 });
    context.changed();
    check(
      'Low frame opacity fades the whole floating panel and a legacy small scale keeps 18px reading text',
      await eventually(
        async () =>
          panel.getOpacity() === 1 &&
          (await js(
            panel,
            `(()=>{const text=document.querySelector('.message-bubble .assistant-response');const frame=document.querySelector('[data-floating]');return Boolean(text)&&getComputedStyle(text).fontSize==='18px'&&Boolean(frame)&&getComputedStyle(frame).opacity==='0.44'})()`,
          )),
      ),
    );
    main.focus();
    check(
      'The answer stays visible and always on top after another window gains focus',
      panel.isVisible() && panel.isAlwaysOnTop(),
    );
    await screenshot(panel, 'floating-faded-low-opacity');
  } finally {
    restoreQuestionCapture();
  }
  await js(bar, 'window.workspace.expandOverlay(false)');

  await js(main, 'window.workspace.reportListening(true, false, true)');
  check(
    'Paused state renders resume and keeps the panel collapsed',
    await eventually(
      async () =>
        (await js(bar, 'Boolean(document.querySelector(\'[aria-label="Resume audio capture"]\'))')) &&
        !panel.isVisible(),
    ),
  );
  const paused = (await state()).overlay.listening;
  check(
    'Pause preserves the recording session and start time',
    paused.active && paused.paused && paused.since === before.since && (await state()).activeSessionId === session.id,
  );
  await screenshot(bar, 'bar-paused');
  await js(main, 'window.workspace.reportListening(true, false, false)');
  await js(bar, "document.querySelector('[data-bar-prompt] input').focus()");
  dispatchShortcut('escape');
  check(
    'First Escape blurs the prompt and keeps the bar',
    await eventually(async () => bar.isVisible() && (await js(bar, 'document.activeElement.tagName !== "INPUT"'))),
  );
  dispatchShortcut('escape');
  check(
    'Next Escape hides the bar and releases its registration without ending recording',
    await eventually(
      async () =>
        !bar.isVisible() && !globalShortcut.isRegistered('Escape') && (await state()).overlay.listening.active,
    ),
  );
  dispatchShortcut('overlay');
  await js(bar, "document.querySelector('[aria-label=" + JSON.stringify('Audio sources') + "]')?.click()");
  check(
    'Audio source control opens the existing audio settings',
    await eventually(() => js(main, "location.hash === '#settings/general'")),
  );
  await js(main, 'window.workspace.reportListening(false, false, false)');
  check('Behavior fixtures contain no renderer console errors', errors.length === 0);
  await fs.writeFile(
    path.join(output, 'result.json'),
    JSON.stringify({ passed: true, checks, consoleErrors: errors, fixture: 'State only; no media capture' }, null, 2),
  );
}
module.exports = { run };
