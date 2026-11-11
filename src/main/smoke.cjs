const { runCredentialSmoke } = require('./smoke-credentials.cjs');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { jpegDataUrl, CAPTURE_IMAGE } = require('./application/context/screenshot-image.cjs');

async function run(context) {
  const output = process.env.LEARNTRANSCRIBER_SMOKE_OUTPUT;
  if (!output) throw new Error('Smoke output directory is required.');
  const checks = [],
    errors = [];
  const { mainWindow, privacy, repositories, saveSettings } = context;
  let reviewedContextSeen = false,
    lastImageRequest,
    lastTranslationRequest,
    imageFailureCount = 0;
  const imageRequests = [],
    providerHeaders = [];
  const check = (name, condition) => {
    assert.ok(condition, name);
    checks.push(name);
    if (process.env.LEARNTRANSCRIBER_SMOKE_PROGRESS) console.log(`[smoke] ${checks.length}: ${name}`);
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // Native state can lag while the smoke runs behind another app (Dock activation, window focus): up to 6 s.
  const until = async (predicate) => {
    for (let i = 0; i < 240; i++) {
      if (predicate()) return;
      await wait(25);
    }
    throw new Error('Native state did not settle.');
  };
  const eventually = async (predicate) => {
    for (let i = 0; i < 80; i++) {
      if (await predicate()) return true;
      await wait(25);
    }
    return false;
  };
  const ready = async (window) => {
    if (window.webContents.isLoadingMainFrame())
      await new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
    for (let i = 0; i < 100; i++) {
      if (
        await window.webContents.executeJavaScript(
          `Boolean(window.workspace && document.querySelector('h1, textarea[aria-label], header[aria-label], [data-floating], [data-notch]'))`,
        )
      )
        return;
      await wait(30);
    }
    throw new Error('Renderer did not become ready.');
  };
  const js = (script) => mainWindow.webContents.executeJavaScript(script, true);
  const settle = () => wait(100);
  const go = async (route) => {
    await js(`location.hash=${JSON.stringify(route)}`);
    await settle();
  };
  // Session attachments live in the composer's + menu: open it, then choose the item by its text.
  const attachAction = async (text) => {
    await press(`document.querySelector('[aria-label="Attach context"]')`);
    for (let i = 0; i < 80 && !(await js(`Boolean(document.querySelector('[role=menuitem]'))`)); i++) await wait(25);
    await js(
      `(()=>{const item=[...document.querySelectorAll('[role=menuitem]')].find((entry)=>entry.textContent.trim()===${JSON.stringify(text)});if(!item)throw new Error('Missing menu item: '+${JSON.stringify(text)});item.click();})()`,
    );
    await settle();
  };
  const press = async (expression) => {
    const point = await js(
      `(()=>{const element=${expression};if(!element)throw new Error('Missing control');element.scrollIntoView({block:'center'});const box=element.getBoundingClientRect();return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};})()`,
    );
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await settle();
  };
  const click = async (text, scope = 'document') => {
    await js(
      `(()=>{const element=[...${scope}.querySelectorAll('button,[role=tab]')].find(item=>item.textContent.trim()===${JSON.stringify(text)}||item.getAttribute('aria-label')===${JSON.stringify(text)});if(!element)throw new Error('Missing control: '+${JSON.stringify(text)});if(element.getAttribute('role')==='tab')element.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));element.click();})()`,
    );
    await settle();
  };
  // Radix menus open on pointer down; the item is then clicked by its text.
  const menuAction = async (trigger, item) => {
    await js(
      `(()=>{const element=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(trigger)});if(!element)throw new Error('Missing menu: '+${JSON.stringify(trigger)});element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));})()`,
    );
    await settle();
    await js(
      `(()=>{const element=[...document.querySelectorAll('[role=menuitem]')].find(entry=>entry.textContent.trim()===${JSON.stringify(item)});if(!element)throw new Error('Missing menu item: '+${JSON.stringify(item)});element.click();})()`,
    );
    await settle();
  };
  const input = async (selector, value) => {
    await js(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input '+${JSON.stringify(selector)});const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
    );
    await settle();
  };
  const field = async (label, value) => {
    const selector = await js(
      `(()=>{const field=[...document.querySelectorAll('label')].find(item=>item.querySelector('span')?.textContent===${JSON.stringify(label)});const element=field?.querySelector('input,textarea');if(!element)throw new Error('Missing field: '+${JSON.stringify(label)});element.setAttribute('data-smoke-field','current');return '[data-smoke-field=current]';})()`,
    );
    await input(selector, value);
    await js(`document.querySelector('[data-smoke-field=current]').removeAttribute('data-smoke-field')`);
  };
  const openSession = async (id) => {
    const active = await js('(async()=> (await window.workspace.state()).activeSessionId)()');
    if (active === id) {
      // Home's primary action now starts listening; Sessions keeps the plain New session action.
      await go('sessions');
      await click('New session');
      check(
        'New session opens the floating panel and preserves the Sessions route',
        await js(`(async()=>location.hash === '#sessions' && (await window.workspace.state()).overlay.expanded)()`),
      );
      await go('session');
      return;
    }
    await go('sessions');
    const title = repositories.sessions.get(id).title;
    await js(
      `(()=>{const row=[...document.querySelectorAll('main button')].find(item=>item.querySelector('strong')?.textContent===${JSON.stringify(title)});if(!row)throw new Error('Missing session');row.click();})()`,
    );
    await settle();
  };
  // Settings sections are links in the sidebar under Settings since the five-destination navigation.
  const settingsTab = async (text) => {
    await go('settings');
    await js(
      `(()=>{const link=[...document.querySelectorAll('.workspace-subnav a')].find((item)=>item.textContent.trim()===${JSON.stringify(text)});if(!link)throw new Error('Missing settings section: '+${JSON.stringify(text)});link.click();})()`,
    );
    await settle();
  };

  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url.startsWith('/v1/')) providerHeaders.push({ url: req.url, headers: req.headers, body });
    if (req.url === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'fixture-model' }] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      const toolBody = JSON.parse(body);
      if (toolBody.messages?.[0]?.content.startsWith('Translate the supplied transcript message into ')) {
        lastTranslationRequest = toolBody;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(
          'data: ' +
            JSON.stringify({ choices: [{ delta: { content: 'Fixture translation: use a bounded queue.' } }] }) +
            '\n\ndata: [DONE]\n\n',
        );
        return;
      }
      if (
        toolBody.messages?.[0]?.content.startsWith('Generate follow-up questions for the supplied assistant answer.')
      ) {
        await wait(250);
        const answer = JSON.stringify([
          { text: 'Review the queue design', prompt: 'Explain the bounded queue validation plan.' },
          { text: 'Check the assumptions', prompt: 'Which assumptions about the bounded queue should we verify?' },
        ]);
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: answer } }] }) + '\n\ndata: [DONE]\n\n');
        return;
      }
      if (toolBody.messages?.[0]?.content.startsWith('Help the user design')) {
        if (toolBody.messages.at(-1).content.includes('delayed-builder')) await wait(700);
        if (toolBody.messages.at(-1).content.includes('commands-builder')) {
          const commands = JSON.stringify({
            message: 'Renamed the draft and proposed saving it.',
            commands: [
              { tool: 'update_assistant_settings', args: { assistant_name: 'Builder commands' } },
              { tool: 'search_assistant_library', args: { query: 'general' } },
              { tool: 'save_assistant_draft', args: { reason: 'ready' } },
              { tool: 'delete_assistant', args: { assistant_name: 'General Assistant' } },
            ],
          });
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: commands } }] }) + '\n\ndata: [DONE]\n\n');
          return;
        }
        const answer = JSON.stringify({
          message: 'Prepared a draft for review.',
          draft: {
            name: 'Builder fixture',
            category: 'Career',
            systemPrompt: toolBody.messages.at(-1).content.includes('shorter')
              ? 'Ask one concise question.'
              : 'Ask one question at a time.',
            realtimePrompt: 'Keep observations brief.',
            followUpPrompt: 'Suggest the next practice question.',
            requireCertainty: true,
          },
        });
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: answer } }] }) + '\n\ndata: [DONE]\n\n');
        return;
      }
      const imageParts = toolBody.messages?.at(-1)?.content;
      if (Array.isArray(imageParts)) {
        lastImageRequest = imageParts.filter((part) => part.type === 'image_url').map((part) => part.image_url.url);
        if (lastImageRequest.length) imageRequests.push(lastImageRequest);
        const prompt = imageParts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join(' ');
        if (prompt.includes('Fail image request') && ++imageFailureCount === 1) {
          res.writeHead(503);
          res.end();
          return;
        }
        if (prompt.includes('Cancel image request')) {
          await wait(800);
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(
            'data: ' +
              JSON.stringify({ choices: [{ delta: { content: 'Late image answer' } }] }) +
              '\n\ndata: [DONE]\n\n',
          );
          return;
        }
      }
      if (toolBody.tools?.some((t) => t.function.name === 'search_past_sessions')) {
        const last = toolBody.messages.at(-1),
          initial = JSON.parse(
            toolBody.messages
              .find((m) => m.content?.startsWith?.('Initial local search results'))
              .content.split('untrusted data): ')[1],
          );
        const id = initial[0]?.session_id;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (last.role !== 'tool')
          res.end(
            'data: ' +
              JSON.stringify({
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: 'memory-read',
                          function: {
                            name: 'read_session_context',
                            arguments: JSON.stringify({ session_id: id, query: 'bounded queue' }),
                          },
                        },
                      ],
                    },
                  },
                ],
              }) +
              '\n\ndata: [DONE]\n\n',
          );
        else if (last.tool_call_id === 'memory-read')
          res.end(
            'data: ' +
              JSON.stringify({
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: 'memory-resume',
                          function: { name: 'resume_session', arguments: JSON.stringify({ session_id: id }) },
                        },
                      ],
                    },
                  },
                ],
              }) +
              '\n\ndata: [DONE]\n\n',
          );
        else
          res.end(
            'data: ' +
              JSON.stringify({ choices: [{ delta: { content: 'History fixture: we chose a bounded queue.' } }] }) +
              '\n\ndata: [DONE]\n\n',
          );
        return;
      }
      const parsed = JSON.parse(body);
      if (parsed.messages.some((m) => m.content.includes?.('Reviewed bounded queue context')))
        reviewedContextSeen = true;
      if (!parsed.messages.some((m) => m.content.includes?.('bounded queue'))) {
        res.writeHead(400);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Fixture answer: ' } }] }) + '\n\n');
      await wait(20);
      res.end(
        'data: ' +
          JSON.stringify({ choices: [{ delta: { content: 'use a bounded queue.' } }] }) +
          '\n\ndata: [DONE]\n\n',
      );
      return;
    }
    if (req.url === '/v1/audio/transcriptions') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({ text: body.includes('blank-audio-fixture') ? '[BLANK_AUDIO]' : 'Transcribed fixture audio.' }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  try {
    await fs.mkdir(output, { recursive: true });
    mainWindow.webContents.on('console-message', (details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    await ready(mainWindow);
    // Reproduce leaving stealth from the hidden workspace while only a floating window is visible.
    mainWindow.hide();
    saveSettings({ stealthMode: true, captureProtection: true });
    await until(() => !context.app.dock.isVisible());
    await js('window.workspace.settings({ stealthMode: false, captureProtection: false })');
    check('Hidden workspace settings IPC resolves when leaving stealth', !repositories.settings.read().stealthMode);
    for (const window of privacy.windows.keys()) {
      await ready(window);
      check(
        'Every window can invoke IPC after leaving stealth',
        Boolean(await window.webContents.executeJavaScript('window.workspace.state()')),
      );
    }
    await until(() => context.app.dock.isVisible());
    saveSettings({ captureProtection: true });
    // These workflows start after setup; dismiss it through the bridge so its native window suppression is released.
    await js(
      `(async()=>{await window.workspace.settings({onboardingDismissed:true});await window.workspace.presentOnboarding(false);})()`,
    );
    // Fixtures select controls by their English labels, independent of the macOS language.
    // The fixtures below start from the earlier quiet baseline and turn the Notch and live insights on themselves.
    saveSettings({
      uiLanguage: 'en',
      notchEnabled: false,
      autoInsights: false,
      liveTranscription: false,
      systemAudio: false,
    });
    await wait(100);
    check('Isolated native workspace loads', await js('Boolean(window.workspace && document.querySelector("h1"))'));
    check(
      'Production shadcn bundle uses native data without preview fallback',
      await js(
        `location.origin==='app://renderer'&&location.pathname==='/index.html'&&!document.body.textContent.includes('Browser preview. Sample workspace only.')`,
      ),
    );
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'credential-storage') {
      await runCredentialSmoke({
        evaluate: js,
        stored: () => repositories.credentials.get('openai'),
        read: () => context.providers.getKey('openai'),
        check,
        progress: (message) => console.log(`[smoke] ${message}`),
      });
      check('Credential probe has no renderer console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'functional-workflows') {
      await require('./smoke-functional-workflows.cjs').run(context, {
        output,
        check,
        wait,
        eventually,
        go,
        click,
        js,
        openSession,
        checks,
        errors,
      });
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'session-behaviors') {
      await require('./smoke-behaviors.cjs').run(context, { output, check, ready, wait, eventually, checks, errors });
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'assistant-templates') {
      await go('assistants');
      await menuAction('More ways to add', 'Import prompt');
      const focusMarkdown = '# Review\n\nUse evidence.';
      await js(
        `(()=>{const picker=document.querySelector('input[aria-label="Markdown assistant file"]');const files=new DataTransfer();files.items.add(new File([${JSON.stringify(focusMarkdown)}],'review-helper.md',{type:'text/markdown'}));picker.files=files.files;picker.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
      check(
        'Markdown review shows its source, name and system prompt only',
        await eventually(() =>
          js(
            `(()=>{const dialog=document.querySelector('[role="dialog"]');if(!dialog?.textContent.includes('Started from review-helper.md'))return false;const labels=[...dialog.querySelectorAll('label')];return labels.length===2&&labels.find(label=>label.querySelector('span')?.textContent==='Name')?.querySelector('input')?.value==='review-helper'&&labels.find(label=>label.querySelector('span')?.textContent==='System prompt')?.querySelector('textarea')?.value===${JSON.stringify(focusMarkdown)};})()`,
          ),
        ),
      );
      await wait(250);
      await fs.writeFile(
        path.join(output, 'assistant-md-review.png'),
        (await mainWindow.webContents.capturePage()).toPNG(),
      );
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'floating-followups') {
      const session = repositories.sessions.create('Floating follow-up fixture', 'general');
      const answer =
        'Review the bounded queue, confirm its capacity, and test the behavior when requests arrive faster than they can be processed.';
      repositories.entries.add(session.id, 'assistant', answer);
      context.setActive(session.id);
      context.changed();
      const overlay = context.createWindow('overlay');
      await ready(overlay);
      privacy.show(overlay, false);
      await overlay.webContents.executeJavaScript(
        `document.querySelector('[aria-label="Open session panel"]')?.click()`,
      );
      check(
        'Floating session expands with its active conversation',
        await eventually(() =>
          overlay.webContents.executeJavaScript(
            `Boolean(document.querySelector('[aria-label="Floating assistant views"]'))`,
          ),
        ),
      );
      overlay.webContents.send('overlay:answer', { text: answer, sessionId: session.id });
      check(
        'Saved answer offers assistant-guided follow-ups in the floating session',
        await eventually(() =>
          overlay.webContents.executeJavaScript(
            `Boolean([...document.querySelectorAll('[data-follow-up-suggestions] button')].find(button=>button.textContent==='Suggested questions'&&!button.disabled))`,
          ),
        ),
      );
      check(
        'Floating follow-up fixture preserves the saved answer',
        repositories.sessions.get(session.id).entries.at(-1)?.content === answer,
      );
      check('Floating renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'ui-language') {
      saveSettings({ notchEnabled: true });
      const session = repositories.sessions.create('Language fixture', 'general');
      repositories.entries.add(session.id, 'assistant', 'A bounded queue keeps memory stable.');
      context.setActive(session.id);
      context.changed();
      const overlay = context.createWindow('overlay');
      await ready(overlay);
      privacy.show(overlay, false);
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch, false);
      const label = (window, selector) =>
        window.webContents.executeJavaScript(
          `document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-label')||''`,
        );
      await go('#settings');
      await click('Language');
      check(
        'Language tab offers system, English, Spanish and Portuguese',
        await eventually(() => js(`Boolean(document.querySelector('[aria-label="Interface language"]'))`)),
      );
      await fs.writeFile(path.join(output, 'language-en.png'), (await mainWindow.webContents.capturePage()).toPNG());
      await js(`window.workspace.settings({uiLanguage:'pt-BR'})`);
      check(
        'Portuguese reaches the workspace navigation and document language',
        await eventually(() =>
          js(
            `document.documentElement.lang==='pt-BR'&&document.querySelector('nav[aria-label="Workspace"]')?.textContent.includes('Sessions')&&document.body.textContent.includes('Configurações')`,
          ),
        ),
      );
      check(
        'Portuguese reaches the floating assistant',
        await eventually(async () => (await label(overlay, 'header')) === 'Ações do assistente flutuante'),
      );
      check(
        'Portuguese reaches the Notch',
        await eventually(async () => (await label(notch, '[data-notch]')) === 'Abrir Notch'),
      );
      await fs.writeFile(
        path.join(output, 'language-pt-settings.png'),
        (await mainWindow.webContents.capturePage()).toPNG(),
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[data-notch]').click()`);
      await wait(400);
      await fs.writeFile(path.join(output, 'language-pt-notch.png'), (await notch.webContents.capturePage()).toPNG());
      await overlay.webContents.executeJavaScript(
        `document.querySelector('[aria-label="Expandir assistente flutuante"]')?.click()`,
      );
      await wait(400);
      await fs.writeFile(
        path.join(output, 'language-pt-overlay.png'),
        (await overlay.webContents.capturePage()).toPNG(),
      );
      mainWindow.webContents.reload();
      await ready(mainWindow);
      check(
        'The chosen language survives reload',
        await eventually(() =>
          js(`document.documentElement.lang==='pt-BR'&&document.body.textContent.includes('Sessions')`),
        ),
      );
      await js(`window.workspace.settings({uiLanguage:'es'})`);
      check(
        'Spanish switches every window',
        await eventually(
          async () =>
            (await js(`document.body.textContent.includes('Sesiones')`)) &&
            (await label(notch, '[data-notch]')) === 'Asistente del Notch',
        ),
      );
      check(
        'Spanish formats the Notch position counter',
        await eventually(() => notch.webContents.executeJavaScript(`document.body.textContent.includes('1 / 1')`)),
      );
      const invalid = await js(`window.workspace.settings({uiLanguage:'fr'}).then(()=>'',error=>error.message)`);
      check(
        'Unsupported interface languages are rejected',
        invalid.includes('supported interface language') && repositories.settings.read().uiLanguage === 'es',
      );
      await js(`window.workspace.settings({uiLanguage:''})`);
      check(
        'System language resolves to a supported locale',
        await eventually(() => js(`['en','es','pt-BR'].includes(document.documentElement.lang)`)),
      );
      check('Interface language renderers contain no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'surface-theme') {
      saveSettings({ notchEnabled: true });
      const session = repositories.sessions.create('Surface theme fixture', 'general');
      repositories.entries.add(session.id, 'assistant', 'A bounded queue keeps memory stable under bursts.');
      context.setActive(session.id);
      context.changed();
      const overlay = context.createWindow('overlay');
      await ready(overlay);
      privacy.show(overlay, false);
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      context.expandNotch(true);
      await ready(notch);
      privacy.show(notch, false);
      const theme = (window) =>
        window.webContents.executeJavaScript(
          `document.documentElement.classList.contains('light')?'light':document.documentElement.classList.contains('dark')?'dark':'none'`,
        );
      check(
        'Floating surfaces start dark',
        (await theme(overlay)) === 'dark' && (await theme(notch)) === 'dark' && (await theme(mainWindow)) === 'dark',
      );
      await go('#privacy');
      await js(`window.workspace.settings({surfaceTheme:'light'})`);
      check(
        'Light appearance reaches the floating assistant and the Notch',
        await eventually(async () => (await theme(overlay)) === 'light' && (await theme(notch)) === 'light'),
      );
      check(
        'Light appearance reaches the workspace',
        await eventually(async () => (await theme(mainWindow)) === 'light'),
      );
      const surface = await eventually(() =>
        notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
      );
      check(
        'Notch uses the light surface token',
        surface &&
          (await notch.webContents
            .executeJavaScript(
              `getComputedStyle(document.querySelector('[aria-label="Notch assistant"]')).backgroundColor`,
            )
            .then((color) => /^(rgb\(255, 255, 255\)|oklch\(1 0 0\))$/.test(color))),
      );
      await overlay.webContents.executeJavaScript(
        `document.querySelector('[aria-label="Open session panel"]')?.click()`,
      );
      await wait(400);
      await fs.writeFile(
        path.join(output, 'surface-light-overlay.png'),
        (await overlay.webContents.capturePage()).toPNG(),
      );
      await fs.writeFile(path.join(output, 'surface-light-notch.png'), (await notch.webContents.capturePage()).toPNG());
      overlay.webContents.reload();
      await ready(overlay);
      check('Light appearance survives reload', await eventually(async () => (await theme(overlay)) === 'light'));
      const invalid = await js(`window.workspace.settings({surfaceTheme:'system'}).then(()=>'',error=>error.message)`);
      check(
        'Unknown appearance values are rejected',
        invalid.includes('dark or light') && repositories.settings.read().surfaceTheme === 'light',
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch settings"]').click()`);
      await settle();
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Light appearance"]').click()`);
      check(
        'The Notch switch returns every window to dark',
        await eventually(
          async () =>
            repositories.settings.read().surfaceTheme === 'dark' &&
            (await theme(overlay)) === 'dark' &&
            (await theme(notch)) === 'dark' &&
            (await theme(mainWindow)) === 'dark',
        ),
      );
      await fs.writeFile(
        path.join(output, 'surface-dark-overlay.png'),
        (await overlay.webContents.capturePage()).toPNG(),
      );
      check('Surface theme renderers contain no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'custom-headers') {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      saveSettings({
        provider: 'custom',
        model: 'fixture-model',
        customBaseUrl: `http://127.0.0.1:${server.address().port}/v1`,
      });
      await js(`window.workspace.saveKey({provider:'custom',key:'fixture-bearer'})`);
      await go('#settings');
      check(
        'Custom provider shows the header editor',
        await eventually(() => js(`Boolean(document.querySelector('[aria-label="Custom headers"]'))`)),
      );
      await click('Add header');
      await input('[aria-label="Header name"]', 'X-Fixture-Team');
      await input('[aria-label="Value for X-Fixture-Team"]', 'fixture-header-value');
      await click('Save headers');
      check(
        'Saved headers expose names but never values',
        await eventually(async () => {
          const state = await js('window.workspace.state()');
          return (
            state.customHeaderNames.join() === 'X-Fixture-Team' &&
            !JSON.stringify(state).includes('fixture-header-value')
          );
        }),
      );
      check(
        'Header values are stored encrypted',
        Boolean(repositories.credentials.get('customHeaders')) &&
          !Buffer.from(repositories.credentials.get('customHeaders')).toString('utf8').includes('fixture-header-value'),
      );
      check(
        'Saved header value is hidden in the editor',
        await eventually(() =>
          js(
            `document.querySelector('[aria-label="Value for X-Fixture-Team"]')?.value===''&&document.querySelector('[aria-label="Value for X-Fixture-Team"]').placeholder.includes('Saved')`,
          ),
        ),
      );
      await fs.writeFile(path.join(output, 'custom-headers.png'), (await mainWindow.webContents.capturePage()).toPNG());
      await click('Save headers');
      const session = repositories.sessions.create('Header fixture', 'general');
      context.setActive(session.id);
      context.changed();
      providerHeaders.length = 0;
      await js(
        `window.workspace.generate({requestId:'header-chat',sessionId:${JSON.stringify(session.id)},mode:'chat',question:'Hello'})`,
      ).catch(() => {});
      const chat = providerHeaders.find((item) => item.url === '/v1/chat/completions');
      check(
        'Chat requests carry the kept custom header and the bearer key',
        chat?.headers['x-fixture-team'] === 'fixture-header-value' &&
          chat.headers.authorization === 'Bearer fixture-bearer',
      );
      await js(`window.workspace.models()`).catch(() => {});
      check(
        'Model listing carries the custom header',
        providerHeaders.some(
          (item) => item.url === '/v1/models' && item.headers['x-fixture-team'] === 'fixture-header-value',
        ),
      );
      const reserved = await js(
        `window.workspace.saveCustomHeaders([{key:'Content-Type',value:'text/plain'}]).then(()=>'',error=>error.message)`,
      );
      check('Reserved transport headers are rejected', reserved.includes('managed by LearnTranscriber'));
      const injected = await js(
        `window.workspace.saveCustomHeaders([{key:'X-A',value:'a\\r\\nX-B: b'}]).then(()=>'',error=>error.message)`,
      );
      check('Header injection is rejected', injected.includes('one line'));
      const smuggled = await js(
        `window.workspace.saveKey({provider:'customHeaders',key:'[]'}).then(()=>'',error=>error.message)`,
      );
      check('The generic key channel cannot overwrite custom headers', smuggled.includes('custom provider settings'));
      await js(`window.workspace.saveCustomHeaders([])`);
      check(
        'Removing every header deletes the stored secret',
        !repositories.credentials.get('customHeaders') &&
          (await js('window.workspace.state()')).customHeaderNames.length === 0,
      );
      check('Custom headers renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'data') {
      const kept = repositories.sessions.create('Clear history fixture', 'general');
      repositories.entries.add(kept.id, 'transcript', 'A bounded queue absorbs bursts', 'THEY');
      repositories.entries.add(kept.id, 'assistant', 'Use a bounded queue.');
      repositories.sessions.update(kept.id, { ended_at: new Date().toISOString() });
      const open = repositories.sessions.create('Open fixture', 'general');
      context.setActive(open.id);
      context.changed();
      await go('#settings');
      await click('Data');
      const statText = () => js(`document.querySelector('[aria-label="History statistics"]')?.textContent||''`);
      check(
        'Data tab shows all-time history statistics',
        await eventually(
          async () => (await statText()).includes('Sessions2') && (await statText()).includes('Open sessions1'),
        ),
      );
      check(
        'Clearing is unavailable during an active session',
        await js(
          `[...document.querySelectorAll('button')].find(item=>item.textContent==='Clear history…')?.disabled===true`,
        ),
      );
      const blocked = await js(`window.workspace.clearHistory().then(()=>'',error=>error.message)`);
      check(
        'Main process refuses to clear during an active session',
        blocked.includes('End the active session') && repositories.history.stats().totalSessions === 2,
      );
      const notch = context.createWindow('overlay');
      await ready(notch);
      const foreign = await notch.webContents.executeJavaScript(
        `window.workspace.clearHistory().then(()=>'',error=>error.message)`,
      );
      check('Only the main workspace may clear history', foreign.includes('main workspace'));
      notch.destroy();
      await js(`window.workspace.endSession(${JSON.stringify(open.id)})`);
      context.changed();
      await settle();
      await click('Clear history…');
      check(
        'Confirmation shows the counts to delete',
        await eventually(() =>
          js(`document.body.textContent.includes('Permanently delete 2 sessions, 1 messages and 1 transcript lines')`),
        ),
      );
      await fs.writeFile(path.join(output, 'data-confirm.png'), (await mainWindow.webContents.capturePage()).toPNG());
      await click('Cancel');
      check(
        'Cancel keeps history',
        repositories.history.stats().totalSessions === 2 &&
          (await js(`!document.body.textContent.includes('Permanently delete')`)),
      );
      await click('Clear history…');
      await click('Delete history');
      check(
        'Confirmed clear removes history and reports counts',
        await eventually(
          async () =>
            repositories.history.stats().totalSessions === 0 &&
            (await js(`document.body.textContent.includes('Removed 2 sessions, 1 messages and 1 transcript lines')`)),
        ),
      );
      check('Search finds no cleared entries', repositories.sessionSearch.list('bounded').length === 0);
      check(
        'Clear button is disabled when history is empty',
        await eventually(() =>
          js(
            `[...document.querySelectorAll('button')].find(item=>item.textContent==='Clear history…')?.disabled===true`,
          ),
        ),
      );
      await fs.writeFile(path.join(output, 'data-cleared.png'), (await mainWindow.webContents.capturePage()).toPNG());
      check('Data renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'notch-settings') {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      saveSettings({
        provider: 'custom',
        model: 'fixture-model',
        customBaseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        notchEnabled: true,
        notchMinimumVisibleSeconds: 1,
        overlayOpacity: 0.95,
      });
      const session = repositories.sessions.create('Notch settings fixture', 'general');
      repositories.entries.add(session.id, 'transcript', 'The bounded queue handles incoming work.', 'THEY');
      repositories.entries.add(
        session.id,
        'assistant',
        'Saved bounded queue answer with enough detail to suggest a useful next question.',
      );
      context.setActive(session.id);
      context.changed();
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch, false);
      const query = (selector) =>
        notch.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      const click = (selector) =>
        notch.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await click('[aria-label="Open Notch"]');
      check(
        'Notch expands with insight follow-ups',
        await eventually(() => query('[aria-label="Insight follow-ups"]')),
      );
      await click('[aria-label="Open Notch settings"]');
      check(
        'Settings view replaces Notch content',
        await eventually(
          async () =>
            (await query('[aria-label="Notch settings"]')) &&
            !(await query('[aria-label="Insight follow-ups"]')) &&
            !(await query('[aria-label="Previous insight"]')),
        ),
      );
      await fs.writeFile(path.join(output, 'notch-settings.png'), (await notch.webContents.capturePage()).toPNG());
      await notch.webContents.executeJavaScript(`window.workspace.settings({notchOpacity:0.6})`);
      check(
        'Notch opacity applies natively without changing the floating assistant',
        (await eventually(() => Math.abs(notch.getOpacity() - 0.6) < 0.01)) &&
          repositories.settings.read().overlayOpacity === 0.95,
      );
      const foreignOpacity = await js(
        `window.workspace.settings({notchOpacity:0.3}).then(()=>'',error=>error.message)`,
      );
      check(
        'Notch opacity rejects values below 45%',
        foreignOpacity.includes('Notch opacity') && repositories.settings.read().notchOpacity === 0.6,
      );
      await click('[aria-label="Transcript insights"]');
      check(
        'Transcript insight trigger toggles from the Notch',
        await eventually(() => repositories.settings.read().autoInsights === true),
      );
      await notch.webContents.executeJavaScript(
        `(()=>{const input=document.querySelector('[aria-label="Notch reading time in seconds"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'12');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));})()`,
      );
      check(
        'Reading time saves from the Notch',
        await eventually(() => repositories.settings.read().notchMinimumVisibleSeconds === 12),
      );
      saveSettings({ notchMinimumVisibleSeconds: 1, autoInsights: false });
      await js(
        `window.workspace.generate({requestId:'notch-settings-insight',sessionId:${JSON.stringify(session.id)},mode:'insight'})`,
      );
      await wait(500);
      check(
        'Settings view withholds the display acknowledgement',
        context.getNotchDisplay().pending?.id === 'notch-settings-insight' &&
          context.getNotchDisplay().displayed?.id !== 'notch-settings-insight',
      );
      await click('[aria-label="Close Notch settings"]');
      check(
        'Returning to content acknowledges the latest insight',
        await eventually(() => context.getNotchDisplay().displayed?.id === 'notch-settings-insight'),
      );
      await click('[aria-label="Open Notch settings"]');
      await settle();
      await click('[aria-label="Follow-up suggestions"]');
      check(
        'Follow-up suggestions toggle from the Notch',
        await eventually(() => repositories.settings.read().notchFollowUps === false),
      );
      await click('[aria-label="Close Notch settings"]');
      await settle();
      check(
        'Disabled follow-ups hide the suggestion controls',
        (await query('[aria-label="Notch assistant"]')) && !(await query('[aria-label="Insight follow-ups"]')),
      );
      await click('[aria-label="Open Notch settings"]');
      await settle();
      await click('[aria-label="Collapse Notch"]');
      await settle();
      await click('[aria-label="Open Notch"]');
      check(
        'Collapsing closes the settings view',
        await eventually(
          async () =>
            (await query('[aria-label="Notch assistant"]')) && !(await query('[aria-label="Notch settings"]')),
        ),
      );
      check('Notch settings renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'notch-followups') {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      saveSettings({
        provider: 'custom',
        model: 'fixture-model',
        customBaseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        notchEnabled: true,
      });
      const session = repositories.sessions.create('Notch history fixture', 'general');
      const older = repositories.entries.add(
        session.id,
        'assistant',
        'Earlier bounded queue answer with enough detail to suggest a useful next question.',
      );
      repositories.entries.add(
        session.id,
        'assistant',
        'Latest bounded queue answer with enough detail to suggest another question.',
      );
      context.setActive(session.id);
      context.changed();
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch, false);
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch"]')?.click()`);
      check(
        'Notch expands with saved assistant history',
        await eventually(() =>
          notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
        ),
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Previous insight"]').click()`);
      check(
        'Older insight remains selectable with its own suggestion action',
        await eventually(() =>
          notch.webContents.executeJavaScript(
            `document.body.textContent.includes('Earlier bounded queue answer')&&Boolean(document.querySelector('[aria-label="Insight follow-ups"] button'))`,
          ),
        ),
      );
      const foreign = await js(
        `window.workspace.followUps({requestId:'foreign-notch-history',sessionId:${JSON.stringify(session.id)},entryId:${JSON.stringify(older.id)},historical:true}).then(()=>'',error=>error.message)`,
      );
      check('Workspace cannot request historical Notch suggestions', foreign.includes('Only the active Notch'));
      await notch.webContents.executeJavaScript(
        `document.querySelector('[aria-label="Insight follow-ups"] button').click()`,
      );
      check(
        'Older insight generates suggestions through the owned Notch',
        await eventually(() =>
          notch.webContents.executeJavaScript(
            `document.querySelector('[aria-label="Insight follow-ups"]')?.textContent.includes('Review the queue design')`,
          ),
        ),
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Next insight"]').click()`);
      await settle();
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Previous insight"]').click()`);
      check(
        'Returning to an older insight retains its suggestions',
        await eventually(() =>
          notch.webContents.executeJavaScript(
            `document.querySelector('[aria-label="Insight follow-ups"]')?.textContent.includes('Review the queue design')`,
          ),
        ),
      );
      check(
        'Historical suggestions do not append conversation entries',
        repositories.sessions.get(session.id).entries.length === 2,
      );
      check('Notch renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'notch-timing') {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      saveSettings({
        provider: 'custom',
        model: 'fixture-model',
        customBaseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        notchEnabled: true,
        notchMinimumVisibleSeconds: 1,
      });
      const session = repositories.sessions.create('Notch timing fixture', 'general');
      repositories.entries.add(session.id, 'transcript', 'The bounded queue handles incoming work.', 'THEY');
      context.setActive(session.id);
      context.changed();
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch, false);
      check(
        'Automatic insight uses the configured one-second minimum',
        repositories.settings.read().notchMinimumVisibleSeconds === 1,
      );
      await js(
        `window.workspace.generate({requestId:'notch-auto-one',sessionId:${JSON.stringify(session.id)},mode:'insight'})`,
      );
      check(
        'Automatic insight expands the Notch and receives a visible acknowledgement',
        await eventually(
          () =>
            context.getNotchDisplay().displayed?.id === 'notch-auto-one' &&
            notch.isVisible() &&
            Boolean(context.getNotchDisplay().displayed.at),
        ),
      );
      const blocked = await js(
        `window.workspace.generate({requestId:'notch-auto-early',sessionId:${JSON.stringify(session.id)},mode:'insight'}).then(()=>'',error=>error.message)`,
      );
      check(
        'Automatic replacement waits after visible acknowledgement without persisting an early answer',
        blocked.includes('remain visible') &&
          repositories.sessions.get(session.id).entries.filter((entry) => entry.kind === 'assistant').length === 1,
      );
      await wait(1100);
      await js(
        `window.workspace.generate({requestId:'notch-auto-later',sessionId:${JSON.stringify(session.id)},mode:'insight'})`,
      );
      check(
        'Automatic insight can replace the previous answer after the minimum time',
        repositories.sessions.get(session.id).entries.filter((entry) => entry.kind === 'assistant').length === 2,
      );
      check('Notch timing renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'notch-interaction') {
      saveSettings({ notchEnabled: true });
      const session = repositories.sessions.create('Notch interaction fixture', 'general');
      context.setActive(session.id);
      context.changed();
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch);
      const ignores = [],
        setIgnore = notch.setIgnoreMouseEvents.bind(notch);
      notch.setIgnoreMouseEvents = (ignore, options) => {
        ignores.push(ignore);
        setIgnore(ignore, options);
      };
      const interactive = () => privacy.notchInteractive.has(notch);
      const pointer = (type, x, y, held = false) => {
        const b = notch.getBounds();
        notch.webContents.sendInputEvent({
          type,
          x: x - b.x,
          y: y - b.y,
          globalX: x,
          globalY: y,
          button: 'left',
          clickCount: 1,
          modifiers: held ? ['leftbuttondown'] : [],
        });
      };
      check('Collapsed Notch starts in click-through mode', !interactive());
      await fs.writeFile(path.join(output, 'notch-before-hover.png'), (await notch.webContents.capturePage()).toPNG());
      const foreign = await js(`window.workspace.setNotchInteractive(true).then(()=>'',error=>error.message)`);
      check('Only the owned Notch may request interaction', foreign.includes('Invalid Notch interaction'));
      const invalid = await notch.webContents.executeJavaScript(
        `window.workspace.setNotchInteractive('yes').then(()=>'',error=>error.message)`,
      );
      check('Notch interaction rejects malformed flags', invalid.includes('Invalid Notch interaction'));
      let b = notch.getBounds();
      pointer('mouseMove', b.x + 30, b.y + 24);
      check(
        'Hover expands the collapsed Notch without a click',
        await eventually(() =>
          notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
        ),
      );
      check('Hover enables native mouse interaction', interactive() && ignores.at(-1) === false);
      await fs.writeFile(path.join(output, 'notch-after-hover.png'), (await notch.webContents.capturePage()).toPNG());
      saveSettings({ overlayClickThrough: true, overlayOpacity: 0.8 });
      check('Settings updates preserve active Notch interaction', interactive() && ignores.at(-1) === false);
      b = notch.getBounds();
      pointer('mouseMove', b.x - 30, b.y - 30);
      pointer('mouseLeave', b.x - 30, b.y - 30);
      await settle();
      check(
        'Leaving restores click-through without collapsing the answer',
        !interactive() &&
          ignores.at(-1) === true &&
          (await notch.webContents.executeJavaScript(
            `Boolean(document.querySelector('[aria-label="Notch assistant"]'))`,
          )),
      );
      await fs.writeFile(path.join(output, 'notch-after-leave.png'), (await notch.webContents.capturePage()).toPNG());
      b = notch.getBounds();
      pointer('mouseMove', b.x + 100, b.y + 25);
      await settle();
      pointer('mouseDown', b.x + 100, b.y + 25);
      await wait(50);
      pointer('mouseLeave', b.x - 30, b.y - 30, true);
      await settle();
      check('Leaving during a captured header gesture retains interaction', interactive() && ignores.at(-1) === false);
      pointer('mouseUp', b.x - 30, b.y - 30);
      await settle();
      check(
        'Ending a header gesture outside releases interaction',
        await eventually(() => !interactive() && ignores.at(-1) === true),
      );
      pointer('mouseMove', b.x + b.width - 10, b.y + b.height - 10);
      await settle();
      pointer('mouseDown', b.x + b.width - 10, b.y + b.height - 10);
      await wait(50);
      pointer('mouseLeave', b.x + b.width + 30, b.y + b.height + 30, true);
      await settle();
      check('Leaving during a captured resize retains interaction', interactive() && ignores.at(-1) === false);
      pointer('mouseUp', b.x + b.width + 30, b.y + b.height + 30);
      await settle();
      check(
        'Ending resize outside restores click-through',
        await eventually(() => !interactive() && ignores.at(-1) === true),
      );
      pointer('mouseMove', b.x + 100, b.y + 25);
      await settle();
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
      await wait(350);
      check(
        'Explicit collapse does not immediately reopen under the cursor',
        await notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Open Notch"]'))`),
      );
      b = notch.getBounds();
      pointer('mouseMove', b.x - 30, b.y - 30);
      await settle();
      pointer('mouseMove', b.x + 30, b.y + 24);
      check(
        'Leaving and reentering permits hover expansion again',
        await eventually(() =>
          notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
        ),
      );
      privacy.conceal();
      context.changed();
      await settle();
      const concealed = await notch.webContents.executeJavaScript(`window.workspace.setNotchInteractive(true)`);
      check(
        'Concealment clears interaction and rejects reactivation',
        !concealed && !interactive() && ignores.at(-1) === true && !notch.isVisible(),
      );
      const hiddenExpansion = await notch.webContents.executeJavaScript(`window.workspace.expandNotch(true)`);
      check('A hidden Notch cannot expand from a late hover request', !hiddenExpansion && !notch.isVisible());
      privacy.restore();
      context.changed();
      await settle();
      check(
        'Restored Notch starts with click-through and capture protection',
        !interactive() && ignores.at(-1) === true && notch.isContentProtected(),
      );
      check('Notch interaction renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    if (process.env.LEARNTRANSCRIBER_SMOKE_FOCUS === 'notch-geometry') {
      saveSettings({ notchEnabled: true });
      const session = repositories.sessions.create('Notch geometry fixture', 'general');
      context.setActive(session.id);
      context.changed();
      const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
      await ready(notch);
      privacy.show(notch, false);
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch"]').click()`);
      check(
        'Expanded Notch exposes drag and resize handles',
        await eventually(() =>
          notch.webContents.executeJavaScript(
            `Boolean(document.querySelector('[aria-label="Drag Notch"]')&&document.querySelector('[aria-label="Resize Notch"]'))`,
          ),
        ),
      );
      const foreign = await js(`window.workspace.moveNotch({x:10,y:10,commit:true}).then(()=>'',error=>error.message)`);
      check('Main workspace cannot move the owned Notch', foreign.includes('unavailable for movement'));
      const foreignResize = await js(
        `window.workspace.resizeNotch({width:600,height:320,commit:true}).then(()=>'',error=>error.message)`,
      );
      check('Main workspace cannot resize the owned Notch', foreignResize.includes('unavailable for resizing'));
      check('Notch uses its bounded resize grip instead of native resizing', !notch.isResizable());
      await fs.writeFile(path.join(output, 'notch-expanded.png'), (await notch.webContents.capturePage()).toPNG());
      const resized = await notch.webContents.executeJavaScript(
        `window.workspace.resizeNotch({width:600,height:320,commit:true})`,
      );
      check(
        'Notch resize persists its bounded expanded size',
        resized.width === 600 &&
          resized.height === 320 &&
          notch.getBounds().width === 600 &&
          repositories.settings.read().notchWidth === 600 &&
          repositories.settings.read().notchHeight === 320,
      );
      const area = require('electron').screen.getDisplayMatching(notch.getBounds()).workArea;
      const moved = await notch.webContents.executeJavaScript(
        `window.workspace.moveNotch({x:${area.x + 30},y:${area.y + 180},commit:true})`,
      );
      check(
        'Drag saves an unpinned position inside the display',
        !repositories.settings.read().notchPinned && moved.x === area.x + 30 && moved.y === area.y + 180,
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
      await settle();
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch"]').click()`);
      await settle();
      check(
        'Expanding restores the moved position and size',
        notch.getBounds().x === moved.x &&
          notch.getBounds().y === moved.y &&
          notch.getBounds().width === 600 &&
          notch.getBounds().height === 320,
      );
      const snapped = await notch.webContents.executeJavaScript(
        `window.workspace.moveNotch({x:${area.x + Math.round((area.width - 600) / 2) + 20},y:${area.y + 18},commit:true})`,
      );
      check(
        'Near-top drag snaps to a pinned display position',
        repositories.settings.read().notchPinned &&
          snapped.x === area.x + Math.round((area.width - 600) / 2) &&
          snapped.y === area.y + 8,
      );
      await wait(100);
      const pointer = (type, globalX, globalY, held = false) => {
        const bounds = notch.getBounds();
        notch.webContents.sendInputEvent({
          type,
          x: globalX - bounds.x,
          y: globalY - bounds.y,
          globalX,
          globalY,
          button: 'left',
          clickCount: 1,
          modifiers: held ? ['leftbuttondown'] : [],
        });
      };
      pointer('mouseMove', snapped.x + 110, snapped.y + 25);
      pointer('mouseDown', snapped.x + 110, snapped.y + 25);
      await wait(50);
      pointer('mouseMove', snapped.x + 320, snapped.y + 210, true);
      await wait(100);
      pointer('mouseUp', snapped.x + 320, snapped.y + 210);
      await wait(250);
      check(
        'Dragging the Notch header moves and unpins the native window',
        !repositories.settings.read().notchPinned && notch.getBounds().y > snapped.y,
      );
      const beforeGesture = notch.getBounds();
      pointer('mouseMove', beforeGesture.x + beforeGesture.width - 10, beforeGesture.y + beforeGesture.height - 10);
      pointer('mouseDown', beforeGesture.x + beforeGesture.width - 10, beforeGesture.y + beforeGesture.height - 10);
      await wait(50);
      pointer(
        'mouseMove',
        beforeGesture.x + beforeGesture.width + 60,
        beforeGesture.y + beforeGesture.height + 40,
        true,
      );
      await wait(100);
      pointer('mouseUp', beforeGesture.x + beforeGesture.width + 60, beforeGesture.y + beforeGesture.height + 40);
      await wait(250);
      check(
        'Dragging the resize grip updates the native size',
        repositories.settings.read().notchWidth > beforeGesture.width &&
          repositories.settings.read().notchHeight > beforeGesture.height,
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
      await settle();
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch"]').click()`);
      await settle();
      check(
        'A header drag does not swallow the next collapsed Notch click',
        await notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
      );
      await fs.writeFile(path.join(output, 'notch-resized.png'), (await notch.webContents.capturePage()).toPNG());
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
      await settle();
      const collapsed = notch.getBounds();
      pointer('mouseMove', collapsed.x + 30, collapsed.y + 24);
      pointer('mouseDown', collapsed.x + 30, collapsed.y + 24);
      await wait(50);
      pointer('mouseMove', collapsed.x + 110, collapsed.y + 124, true);
      await wait(100);
      pointer('mouseUp', collapsed.x + 110, collapsed.y + 124);
      await settle();
      check(
        'Dragging the collapsed Notch saves its position without opening it',
        !repositories.settings.read().notchPinned &&
          notch.getBounds().y > collapsed.y &&
          (await notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Open Notch"]'))`)),
      );
      await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Open Notch"]').click()`);
      await settle();
      check(
        'A click after a collapsed drag opens the saved geometry',
        await notch.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Notch assistant"]'))`),
      );
      check('Geometry changes preserve Notch capture protection', notch.isContentProtected());
      check('Notch geometry renderer contains no runtime console errors', errors.length === 0);
      await fs.writeFile(
        path.join(output, 'result.json'),
        JSON.stringify({ passed: true, checks, consoleErrors: errors }, null, 2),
      );
      return;
    }
    check('Capture protection is applied before presentation', mainWindow.isContentProtected());
    const overlay = context.createWindow('overlay');
    await ready(overlay);
    check('New floating window inherits capture protection', overlay.isContentProtected());
    privacy.show(overlay, false);
    privacy.show(mainWindow);
    privacy.conceal();
    await wait(80);
    check('Emergency hide removes both visible windows', !overlay.isVisible() && !mainWindow.isVisible());
    saveSettings({ overlayOpacity: 0.65, overlayClickThrough: true, hideDock: true });
    check('Settings updates cannot reveal concealed windows', !mainWindow.isVisible() && !overlay.isVisible());
    await until(() => !context.app.dock.isVisible());
    check('Dock icon hides', !context.app.dock.isVisible());
    const late = context.createWindow('overlay');
    await ready(late);
    check('New windows stay hidden during concealment', privacy.show(late) === false && !late.isVisible());
    privacy.restore();
    await wait(80);
    check(
      'Explicit restore recovers only previously visible windows',
      mainWindow.isVisible() && overlay.isVisible() && !late.isVisible(),
    );
    check('Floating text remains opaque at a lower frame opacity', Math.abs(overlay.getOpacity() - 1) < 0.03);
    saveSettings({ captureProtection: false, hideDock: false, overlayClickThrough: false, overlayOpacity: 0.95 });
    check(
      'Capture protection is reversible across all windows',
      [mainWindow, overlay, late].every((w) => !w.isContentProtected()),
    );
    await until(() => context.app.dock.isVisible());
    check('Dock icon restores', context.app.dock.isVisible());
    await go('privacy');
    saveSettings({ captureProtection: false, hideDock: false });
    await settle();
    await press(`document.querySelector('[role=switch][aria-label="Enable stealth mode"]')`);
    check(
      'Stealth mode UI protects both windows and clears their native titles',
      repositories.settings.read().stealthMode &&
        mainWindow.isContentProtected() &&
        overlay.isContentProtected() &&
        mainWindow.getTitle() === '' &&
        overlay.getTitle() === '',
    );
    check(
      'Stealth forces individual controls without overwriting saved preferences',
      !repositories.settings.read().captureProtection &&
        !repositories.settings.read().hideDock &&
        (await js(
          `document.querySelector('[aria-label="Request capture protection"]').getAttribute('aria-checked')==='true'&&document.querySelector('[aria-label="Request capture protection"]').disabled&&document.querySelector('[aria-label="Hide Dock and app-switcher entry"]').disabled`,
        )),
    );
    await until(() => !context.app.dock.isVisible());
    check('Stealth mode hides the Dock at the operating-system level', !context.app.dock.isVisible());
    await js(`document.title='Unexpected session title'`);
    await settle();
    check('Renderer title changes cannot reveal the protected native title', mainWindow.getTitle() === '');
    const stealthLate = context.createWindow('overlay');
    await ready(stealthLate);
    privacy.show(stealthLate, false);
    check(
      'Windows created during stealth inherit native protection and empty titles',
      stealthLate.isContentProtected() && stealthLate.getTitle() === '',
    );
    const { execFile } = require('node:child_process');
    const metadata = JSON.parse(
      await new Promise((resolve, reject) =>
        execFile(
          '/usr/bin/swift',
          [
            process.env.LEARNTRANSCRIBER_SMOKE_PROBE ||
              path.resolve(__dirname, '../../scripts/capture-protection-probe.swift'),
            String(process.pid),
          ],
          { timeout: 10000 },
          (error, stdout) => (error ? reject(error) : resolve(stdout)),
        ),
      ),
    );
    const protectedIds = [mainWindow, overlay, stealthLate].map((window) =>
      Number(window.getMediaSourceId().split(':')[1]),
    );
    check(
      'macOS reports sharing disabled for all three protected app windows',
      protectedIds.every((id) => metadata.some((window) => window.id === id && window.sharingState === 0)),
    );
    await fs.writeFile(path.join(output, 'stealth-window-metadata.json'), JSON.stringify(metadata, null, 2));
    if (process.env.LEARNTRANSCRIBER_ORCA_WINDOW_PROBE === '1') {
      const hiddenListing = JSON.parse(
        await new Promise((resolve, reject) =>
          execFile(
            'orca',
            ['computer', 'list-windows', '--app', 'pid:' + process.pid, '--json'],
            { timeout: 10000 },
            (error, stdout) => (error ? reject(error) : resolve(stdout)),
          ),
        ),
      );
      check(
        'Protected windows are excluded from Orca visible-window discovery',
        hiddenListing.ok && hiddenListing.result.windows.length === 0,
      );
    }

    await fs.writeFile(path.join(output, 'stealth-1280.png'), (await mainWindow.webContents.capturePage()).toPNG());
    saveSettings({ showMenuBarIcon: false });
    const recoveryState = await js('window.workspace.state()');
    check(
      'Menu icon hiding preserves a recovery path',
      recoveryState.privacy.shortcutStatus.hide
        ? !recoveryState.privacy.menuBarIconVisible
        : recoveryState.privacy.menuBarIconVisible && recoveryState.privacy.menuBarRecoveryFallback,
    );
    await js('window.workspace.settings({ showMenuBarIcon: true, stealthMode: false })');
    check(
      'Leaving stealth through renderer IPC resolves and every window can still call IPC',
      Boolean(await js('window.workspace.state()')) &&
        Boolean(await overlay.webContents.executeJavaScript('window.workspace.state()')),
    );
    check(
      'Leaving stealth restores saved individual settings and native titles',
      !mainWindow.isContentProtected() &&
        !overlay.isContentProtected() &&
        mainWindow.getTitle() === 'LearnTranscriber' &&
        !repositories.settings.read().hideDock,
    );
    await until(() => context.app.dock.isVisible());
    check('Leaving stealth restores the Dock', context.app.dock.isVisible());
    stealthLate.destroy();
    saveSettings({ captureProtection: true });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/v1`;
    saveSettings({
      provider: 'custom',
      customBaseUrl: base,
      model: 'fixture-model',
      transcriptionProvider: 'custom',
      transcriptionBaseUrl: base,
    });
    const assistantCount = repositories.assistants.all().length,
      selectedBeforeBuilder = repositories.settings.read().assistantId,
      sessionsBeforeBuilder = repositories.sessionSearch.list().length;
    await go('assistants');
    await menuAction('More ways to add', 'Build with AI');
    await input('[aria-label="Assistant requirements"]', 'Help me prepare for technical interviews.');
    await click('Generate draft');
    for (
      let i = 0;
      i < 100 &&
      !(await js(
        "document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Builder fixture')",
      ));
      i++
    )
      await wait(25);
    check(
      'Conversational builder creates only an unsaved draft without sessions or active assistant changes',
      repositories.assistants.all().length === assistantCount &&
        repositories.sessionSearch.list().length === sessionsBeforeBuilder &&
        repositories.settings.read().assistantId === selectedBeforeBuilder &&
        (await js(
          "document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Builder fixture')",
        )),
    );
    await input('[aria-label="Assistant requirements"]', 'Use shorter questions.');
    await click('Refine draft');
    for (
      let i = 0;
      i < 100 &&
      !(await js(
        "document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Ask one concise question.')",
      ));
      i++
    )
      await wait(25);
    check(
      'Builder refines the visible draft before explicit review',
      repositories.assistants.all().length === assistantCount &&
        (await js(
          "document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Ask one concise question.')",
        )),
    );
    await input('[aria-label="Assistant requirements"]', 'delayed-builder');
    await click('Refine draft');
    await click('Cancel generation');
    await wait(800);
    check(
      'Cancelling builder generation keeps the reviewed draft and unsent requirements',
      repositories.assistants.all().length === assistantCount &&
        (await js(
          "document.querySelector('[aria-label=\"Assistant requirements\"]').value==='delayed-builder'&&document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Ask one concise question.')",
        )),
    );
    await js("document.querySelector('[aria-label=\"Assistant builder\"]').scrollIntoView({block:'start'})");
    await settle();
    await fs.writeFile(
      path.join(output, 'assistant-builder.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    await click('Review draft');
    await click('Save assistant', "document.querySelector('[role=dialog]')");
    const savedBuilder = repositories.assistants.all().find((item) => item.name === 'Builder fixture');
    check(
      'Builder draft is persisted only by the reviewed Save assistant action',
      Boolean(savedBuilder) &&
        savedBuilder.prompt === 'Ask one concise question.' &&
        savedBuilder.realtime_prompt === 'Keep observations brief.' &&
        savedBuilder.require_certainty &&
        repositories.assistants.all().length === assistantCount + 1,
    );
    await js(`window.workspace.deleteAssistant(${JSON.stringify(savedBuilder.id)})`);
    await input('[aria-label="Assistant requirements"]', 'commands-builder');
    await click('Refine draft');
    for (let i = 0; i < 100 && !(await js('Boolean(document.querySelector(\'[aria-label="Proposed actions"]\'))')); i++)
      await wait(25);
    check(
      'Builder commands edit the draft and run library search without saving',
      repositories.assistants.all().length === assistantCount &&
        (await js(
          "document.querySelector('[aria-label=\"Generated assistant draft\"]')?.textContent.includes('Builder commands')&&document.querySelector('[aria-label=\"Library results\"]')?.textContent.includes('General Assistant')",
        )),
    );
    check(
      'Unconfirmed deletion proposals cannot be applied',
      await js(
        "[...document.querySelectorAll('[aria-label=\"Proposed actions\"] button')].find(item=>item.textContent==='Apply'&&item.closest('div.rounded-lg').textContent.includes('Delete General Assistant'))?.disabled===true",
      ),
    );
    await js(
      "[...document.querySelectorAll('[aria-label=\"Proposed actions\"] button')].find(item=>item.textContent==='Apply'&&item.closest('div.rounded-lg').textContent.includes('Save the draft'))?.click()",
    );
    for (let i = 0; i < 100 && !repositories.assistants.all().some((item) => item.name === 'Builder commands'); i++)
      await wait(25);
    const commanded = repositories.assistants.all().find((item) => item.name === 'Builder commands');
    check(
      'Applying a save proposal persists the draft and reports the result',
      Boolean(commanded) &&
        commanded.prompt === 'Ask one concise question.' &&
        (await eventually(() =>
          js(
            "document.querySelector('[aria-label=\"Proposed actions\"]')?.textContent.includes('Saved Builder commands.')",
          ),
        )) &&
        repositories.assistants.all().some((item) => item.id === 'general'),
    );
    if (commanded) await js(`window.workspace.deleteAssistant(${JSON.stringify(commanded.id)})`);
    await click('Close builder');
    const s = await js('window.workspace.createSession("Native verification session")');
    await js(
      `window.workspace.appendTranscript({sessionId:${JSON.stringify(s.id)},speaker:'THEY',text:'We decided to use a bounded queue.'})`,
    );
    check(
      'Model discovery reaches configured local endpoint',
      (await js('window.workspace.models()'))[0] === 'fixture-model',
    );
    const result = await js(
      `window.workspace.generate({requestId:'native-fixture',sessionId:${JSON.stringify(s.id)},mode:'chat',question:'What did we decide?'})`,
    );
    check('Renderer IPC streams through a local HTTP provider', result === 'Fixture answer: use a bounded queue.');
    check(
      'Conversation output is persisted',
      repositories.sessions.get(s.id).entries.some((e) => e.kind === 'assistant' && e.content === result),
    );
    await js(
      `window.workspace.generate({requestId:'summary-fixture',sessionId:${JSON.stringify(s.id)},mode:'summary'})`,
    );
    check('Generated summary is persisted', repositories.sessions.get(s.id).summary.includes('bounded queue'));
    const originalOverview = repositories.sessions.get(s.id).summary,
      originalOverviewEntries = repositories.sessions.get(s.id).entries.length;
    const rewrittenOverview = await js(
      `window.workspace.generate({requestId:'summary-rewrite-fixture',sessionId:${JSON.stringify(s.id)},mode:'summaryRewrite',draft:'Current overview',instructions:'Clarify the bounded queue decision.'})`,
    );
    check(
      'Overview rewrite returns a preview without changing stored summary or transcript',
      rewrittenOverview.includes('bounded queue') &&
        repositories.sessions.get(s.id).summary === originalOverview &&
        repositories.sessions.get(s.id).entries.length === originalOverviewEntries,
    );
    await js(
      `window.workspace.updateSummary({id:${JSON.stringify(s.id)},summary:'Manual overview: bounded queue.',expectedSummary:${JSON.stringify(repositories.sessions.get(s.id).summary)}})`,
    );
    check(
      'Manual overview saves through native IPC',
      repositories.sessions.get(s.id).summary === 'Manual overview: bounded queue.' &&
        repositories.sessions.get(s.id).entries.length === originalOverviewEntries,
    );
    const transcript = await js(
      `window.workspace.transcribe({sessionId:${JSON.stringify(s.id)},speaker:'ME',mime:'audio/webm',bytes:new Uint8Array([1,2,3]).buffer})`,
    );
    check(
      'Audio upload IPC stores returned transcript',
      transcript === 'Transcribed fixture audio.' &&
        repositories.sessions.get(s.id).entries.some((e) => e.content === transcript),
    );
    await js(`import('./assets/audio-capture.js').then(module=>{window.AudioCapture=module.AudioCapture})`);
    const beforeSilence = repositories.sessions.get(s.id).entries.length;
    const blankBytes = JSON.stringify([...Buffer.from('RIFFblank-audio-fixture')]);
    const silentMeeting = await js(
      `window.workspace.transcribe({sessionId:${JSON.stringify(s.id)},speaker:'ME',mime:'audio/wav',bytes:new Uint8Array(${blankBytes}).buffer})`,
    );
    check(
      'Silence markers do not become persisted meeting transcripts',
      silentMeeting === '' && repositories.sessions.get(s.id).entries.length === beforeSilence,
    );
    const silentDictation = await js(
      `window.workspace.transcribeMemory({requestId:'blank-dictation',mime:'audio/wav',bytes:new Uint8Array(${blankBytes}).buffer})`,
    );
    check('Dictation returns no editable text for the blank-audio marker', silentDictation === '');
    const capabilities = await js('window.workspace.speechCapabilities()');
    check(
      'Bundled Apple Speech helper exposes capabilities without prompting',
      typeof capabilities.supportsOnDeviceRecognition === 'boolean' && Array.isArray(capabilities.locales),
    );
    await js(`(async()=>{
      const capture=new AudioCapture(window.workspace,()=>{});
      const sources=capture.pipeline.sources;await sources.open(()=>{});
      const destination=sources.context.createMediaStreamDestination();
      const oscillator=sources.context.createOscillator();oscillator.connect(destination);oscillator.start();
      capture.sessionId=${JSON.stringify(s.id)};capture.recording=true;
      capture.pipeline.addSource(destination.stream,'ME');
      for(let attempt=0;attempt<250&&!sources.inputs[0].chunks.length;attempt++)await new Promise(resolve=>setTimeout(resolve,20));
      if(!sources.inputs[0].chunks.length)throw new Error('The audio processor did not deliver generated samples.');
      oscillator.stop();await capture.stop();
      if(capture.failed.length)throw new Error('Generated PCM audio did not transcribe through the fixture endpoint.');
    })()`);
    check(
      'Real AudioWorklet flush uploads standalone PCM WAV through native IPC',
      repositories.sessions.get(s.id).entries.filter((e) => e.content === 'Transcribed fixture audio.').length >= 2,
    );
    // Dictation fills a question box; it never adds to the session.
    const entriesBeforeDictation = repositories.sessions.get(s.id).entries.length;
    await js(`(async()=>{
      const capture=new AudioCapture({transcribe:segment=>window.workspace.transcribeMemory({...segment,requestId:crypto.randomUUID()}).then(value=>{window.__dictationResult=value;})},()=>{});
      const sources=capture.pipeline.sources;await sources.open(()=>{});const destination=sources.context.createMediaStreamDestination();const oscillator=sources.context.createOscillator();oscillator.connect(destination);oscillator.start();capture.recording=true;capture.pipeline.addSource(destination.stream,'ME');
      for(let i=0;i<250&&!sources.inputs[0].chunks.length;i++)await new Promise(resolve=>setTimeout(resolve,20));oscillator.stop();await capture.stop();if(capture.failed.length)throw new Error('Synthetic dictation failed.');
    })()`);
    check(
      'Synthetic dictation returns text without adding a session transcript',
      repositories.sessions.get(s.id).entries.length === entriesBeforeDictation &&
        (await js(`window.__dictationResult==='Transcribed fixture audio.'`)),
    );
    await openSession(s.id);
    await wait(150);
    check(
      'Session UI displays persisted transcript',
      await js('document.querySelector("main").textContent.includes("bounded queue")'),
    );
    // Overview editing was removed on 2026-11-05 at the owner's request: the summary is read-only and copyable. The
    // later Floating summary check reads the overview saved here through the bridge.
    await click('Summary');
    await js(
      `window.workspace.updateSummary({id:${JSON.stringify(s.id)},summary:'Retried overview: bounded queue.',expectedSummary:${JSON.stringify(repositories.sessions.get(s.id).summary)}})`,
    );
    const readOnlySummary = `document.querySelector('main').textContent.includes('Retried overview: bounded queue.')&&![...document.querySelectorAll('button')].some(item=>item.textContent==='Edit overview')`;
    for (let i = 0; i < 40 && !(await js(readOnlySummary)); i++) await wait(25);
    check('Summary tab shows the saved overview read-only, without an edit control', await js(readOnlySummary));
    await click('Transcript');
    // The gallery and pending-capture checks attach screenshots; a fresh profile asks about them at once instead.
    saveSettings({ quickScreenshot: false });
    await settle();
    const restoreGalleryCapture = context.setCapture(() => mainWindow.webContents.capturePage());
    try {
      await attachAction('Capture screen');
      for (
        let i = 0;
        i < 80 && !(await js("document.querySelector('[aria-label^=Attached]')?.querySelectorAll('img').length"));
        i++
      )
        await wait(25);
      await attachAction('Capture screen');
      for (
        let i = 0;
        i < 80 && !(await js("document.querySelector('[aria-label^=Attached]')?.querySelectorAll('img').length===2"));
        i++
      )
        await wait(25);
      const secondImage = await js("document.querySelectorAll('[aria-label^=Attached] img')[1]?.src");
      check(
        'Screenshot gallery holds two ordered captures',
        Boolean(secondImage) && (await js("document.querySelectorAll('[aria-label^=Attached] img').length===2")),
      );
      await press("document.querySelector('[aria-label^=Remove]')");
      await input('#chat-input', 'Compare the remaining screenshot with the bounded queue decision.');
      await click('Send question');
      for (let i = 0; i < 100 && (await js("Boolean(document.querySelector('[aria-label^=Attached]'))")); i++)
        await wait(30);
      check(
        'Removing the first capture sends only the second and clears the submitted queue',
        lastImageRequest?.length === 1 &&
          lastImageRequest[0] === secondImage &&
          (await js("!document.querySelector('[aria-label^=Attached]')")),
      );
      const firstRetryImage =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NofoAAAAASUVORK5CYII=';
      await js(
        `window.dispatchEvent(new CustomEvent('screenshot-captured',{detail:${JSON.stringify(firstRetryImage)}}))`,
      );
      await input('#chat-input', 'Fail image request for bounded queue.');
      await click('Send question');
      for (
        let i = 0;
        i < 100 && !(await js("document.querySelector('#chat-input')?.value.includes('Fail image request')"));
        i++
      )
        await wait(30);
      check(
        'Failed image generation keeps its attachment and question for retry',
        (await js(
          "document.querySelectorAll('[aria-label^=Attached] img').length===1&&document.querySelector('#chat-input')?.value.includes('Fail image request')",
        )) && imageRequests.at(-1)?.[0] === firstRetryImage,
      );
      await click('Send question');
      for (let i = 0; i < 100 && (await js("Boolean(document.querySelector('[aria-label^=Attached]'))")); i++)
        await wait(30);
      check(
        'Retry sends the preserved image once and clears it after success',
        imageFailureCount === 2 &&
          imageRequests.at(-1)?.length === 1 &&
          imageRequests.at(-1)?.[0] === firstRetryImage &&
          (await js("!document.querySelector('[aria-label^=Attached]')")),
      );
      await js(
        `window.dispatchEvent(new CustomEvent('screenshot-captured',{detail:${JSON.stringify(firstRetryImage)}}))`,
      );
      const beforeCancelledRequest = imageRequests.length;
      await input('#chat-input', 'Cancel image request for bounded queue.');
      await click('Send question');
      for (let i = 0; i < 100 && imageRequests.length === beforeCancelledRequest; i++) await wait(20);
      const laterImage = (await mainWindow.webContents.capturePage()).toDataURL();
      await js(`window.dispatchEvent(new CustomEvent('screenshot-captured',{detail:${JSON.stringify(laterImage)}}))`);
      await click('Cancel response');
      for (
        let i = 0;
        i < 100 && !(await js("document.querySelector('#chat-input')?.value.includes('Cancel image request')"));
        i++
      )
        await wait(20);
      check(
        'Cancel retains the submitted image and a later unrelated attachment',
        imageRequests.at(-1)?.length === 1 &&
          imageRequests.at(-1)?.[0] === firstRetryImage &&
          (await js(
            "document.querySelectorAll('[aria-label^=Attached] img').length===2&&document.querySelector('#chat-input')?.value.includes('Cancel image request')",
          )),
      );
      await press("document.querySelector('[aria-label^=Remove]')");
      check(
        'Removing the cancelled image leaves the later attachment ready',
        (await js("document.querySelectorAll('[aria-label^=Attached] img').length===1")) &&
          (await js("document.querySelector('[aria-label^=Attached] img')?.src")) === laterImage,
      );
      await press("document.querySelector('[aria-label^=Remove]')");
      const pendingImage = await mainWindow.webContents.capturePage();
      let releaseCapture;
      const heldCapture = new Promise((resolve) => {
        releaseCapture = resolve;
      });
      const restorePendingCapture = context.setCapture(() => heldCapture);
      try {
        const requestsBeforeCapture = imageRequests.length;
        await attachAction('Capture screen');
        await input('#chat-input', 'Use the pending capture for bounded queue.');
        await click('Send question');
        check('Submitting a question waits for in-progress capture', imageRequests.length === requestsBeforeCapture);
        releaseCapture(pendingImage);
        for (let i = 0; i < 100 && imageRequests.length === requestsBeforeCapture; i++) await wait(20);
        for (let i = 0; i < 100 && (await js("Boolean(document.querySelector('[aria-label^=Attached]'))")); i++)
          await wait(20);
        check(
          'Pending capture is sent once after it completes',
          imageRequests.length === requestsBeforeCapture + 1 &&
            imageRequests.at(-1)?.length === 1 &&
            imageRequests.at(-1)?.[0] === jpegDataUrl(pendingImage, CAPTURE_IMAGE) &&
            (await js("!document.querySelector('[aria-label^=Attached]')")),
        );
      } finally {
        releaseCapture(pendingImage);
        restorePendingCapture();
      }
    } finally {
      restoreGalleryCapture();
    }
    await js(
      `window.workspace.appendTranscript({sessionId:${JSON.stringify(s.id)},speaker:'ME',text:'<img src=x onerror=alert(1)>'})`,
    );
    await wait(100);
    check(
      'Transcript markup is rendered as text',
      await js('document.querySelector("main").textContent.includes("<img") && !document.querySelector("main img")'),
    );
    await go('privacy');
    await wait(80);
    check(
      'Privacy UI shows stealth mode and the window controls without meeting checklists',
      await js(
        'document.querySelector("main").textContent.includes("Window controls") && !document.querySelector("main").textContent.includes("Teams")',
      ),
    );
    await fs.writeFile(path.join(output, 'privacy-desktop.png'), (await mainWindow.webContents.capturePage()).toPNG());
    await go('session');
    await wait(80);
    await fs.writeFile(path.join(output, 'session-desktop.png'), (await mainWindow.webContents.capturePage()).toPNG());
    // The expand button lives on the separate recording bar; the panel is expanded through the same IPC it uses.
    await overlay.webContents.executeJavaScript('window.workspace.expandOverlay(true)');
    check(
      'Floating assistant is expanded for response checks',
      await eventually(() =>
        overlay.webContents.executeJavaScript(
          `Boolean(document.querySelector('[aria-label="Floating assistant views"]'))`,
        ),
      ),
    );
    overlay.setContentSize(560, 560);
    // The opacity control sits in the panel's own settings.
    await overlay.webContents.executeJavaScript(`document.querySelector('[aria-label="Floating settings"]').click()`);
    await settle();
    check(
      'Floating opacity percentage stays on one line at 560 pixels',
      await overlay.webContents.executeJavaScript(`(()=>{
        const value=document.querySelector('output');
        value.textContent='100%';
        const bounds=value.getBoundingClientRect();
        return bounds.height<=parseFloat(getComputedStyle(value).lineHeight)+1 &&
          bounds.width>=36 && document.documentElement.scrollWidth<=innerWidth;
      })()`),
    );
    await overlay.webContents.executeJavaScript(`document.querySelector('[aria-label="Floating settings"]').click()`);
    await settle();
    // Answers show on the Session tab; the panel opens on the transcript.
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating assistant views"] button:nth-child(2)').click()`,
    );
    // Unrelated generations can still answer during these fixtures, so each attempt resends the fixture event.
    const fixtureAnswer = () =>
      overlay.webContents.send('overlay:answer', { text: 'Fixture answer: use a bounded queue.' });
    check(
      'Floating shadcn assistant receives backend answers',
      await eventually(() => {
        fixtureAnswer();
        return wait(25).then(() =>
          overlay.webContents.executeJavaScript(
            `document.body.textContent.includes('Fixture answer: use a bounded queue.')`,
          ),
        );
      }),
    );
    await fs.writeFile(path.join(output, 'overlay-desktop.png'), (await overlay.webContents.capturePage()).toPNG());
    overlay.setContentSize(360, 500);
    await settle();
    check(
      'Floating assistant fits its 360px minimum width',
      await overlay.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth'),
    );
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating assistant views"] button:nth-child(1)').click()`,
    );
    await settle();
    check(
      'Floating transcript shows saved text without parsing markup',
      await overlay.webContents.executeJavaScript(
        `document.body.textContent.includes('<img src=x onerror=alert(1)>')&&!document.querySelector('img[src=x]')`,
      ),
    );
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating assistant views"] button:nth-child(3)').click()`,
    );
    await settle();
    check(
      'Floating summary loads from the active session',
      await overlay.webContents.executeJavaScript(
        `document.body.textContent.includes('Retried overview: bounded queue.')`,
      ),
    );
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating settings"]').click(),setTimeout(()=>document.querySelector('[aria-label="Increase floating font size"]').click(),50)`,
    );
    await settle();
    check(
      'Floating font control persists its bounded setting',
      repositories.settings.read().unifiedModalFontScale === 1.1,
    );
    // The recording bar is its own window: minimizing collapses the panel's views, and the bar's expand button,
    // here its IPC, brings them back.
    await overlay.webContents.executeJavaScript(`document.querySelector('[aria-label="Close session panel"]').click()`);
    await settle();
    check(
      'Minimizing the floating panel collapses its session views',
      await eventually(
        async () =>
          !(await overlay.webContents.executeJavaScript(
            `Boolean(document.querySelector('[aria-label="Floating assistant views"]'))`,
          )),
      ),
    );
    await overlay.webContents.executeJavaScript('window.workspace.expandOverlay(true)');
    await settle();
    check(
      'Floating modal restores its session views',
      await eventually(
        async () =>
          overlay.isVisible() &&
          (await overlay.webContents.executeJavaScript(
            `Boolean(document.querySelector('[aria-label="Floating assistant views"]'))`,
          )),
      ),
    );
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating assistant views"] button:nth-child(2)').click()`,
    );
    await settle();
    const localManager = context.localModels,
      originalSpawn = localManager.spawn;
    const runtimeFixture = path.join(output, 'runtime-fixture.cjs');
    await fs.writeFile(
      runtimeFixture,
      `const {createServer}=require('node:http');const port=Number(process.argv[process.argv.indexOf('--port')+1]);const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=['/apply-template','/tokenize'].includes(req.url)?JSON.parse(raw):{};if(req.url==='/v1/chat/completions'){res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:'Managed local fixture answer'}}]})+'\\n\\ndata: [DONE]\\n\\n');}else{res.setHeader('content-type','application/json');let result={status:'ok'};if(req.url==='/props')result={default_generation_settings:{n_ctx:Number(process.argv[process.argv.indexOf('-c')+1])},total_slots:1};if(req.url==='/apply-template')result={prompt:JSON.stringify(body)};if(req.url==='/tokenize')result={tokens:Array(Math.ceil(body.content.length/4)).fill(1)};if(req.url==='/inference')result={text:'Managed Whisper fixture transcript'};res.end(JSON.stringify(result));}});server.listen(port,'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`,
    );
    localManager.spawn = (_binary, args, options) =>
      require('node:child_process').spawn(
        process.env.LEARNTRANSCRIBER_SMOKE_NODE || process.execPath,
        [runtimeFixture, ...args],
        {
          ...options,
          env: { ...options.env, ELECTRON_RUN_AS_NODE: '1' },
        },
      );
    try {
      for (const type of ['llm', 'whisper']) {
        const modelFile = path.join(output, type + '.model');
        await fs.writeFile(
          modelFile,
          type === 'llm' ? Buffer.from('GGUF local fixture') : Buffer.from([0x6c, 0x6d, 0x67, 0x67, 0, 0, 0, 0]),
        );
        const model = await localManager.importFile(type, modelFile);
        await localManager.setBinary(type, process.execPath);
        await js(`window.workspace.startLocalModel(${JSON.stringify(model.id)})`);
      }
      saveSettings({ provider: 'local', transcriptionProvider: 'local' });
      const active = repositories.sessionSearch.list()[0].id;
      context.setActive(active);
      check(
        'Managed local LLM streams through renderer IPC',
        (await js(
          `window.workspace.generate({requestId:'managed-local',sessionId:${JSON.stringify(active)},mode:'chat',question:'Local model test'})`,
        )) === 'Managed local fixture answer',
      );
      const capacityBefore = repositories.sessions.get(active).entries.length;
      check(
        'Managed runtime publishes its effective context capacity',
        localManager.state().runtimes.llm.contextSize === 4096,
      );
      const overflowMessage = await js(
        `window.workspace.generate({requestId:'managed-overflow',sessionId:${JSON.stringify(active)},mode:'chat',question:'oversized '.repeat(2000)}).then(()=>'',error=>error.message)`,
      );
      check(
        'Oversized native requests reject before persisting a question',
        overflowMessage.includes('local prompt needs') &&
          repositories.sessions.get(active).entries.length === capacityBefore &&
          localManager.runtimes.llm.users === 0,
      );
      const originalPreflight = context.providers.checkContext;
      let preflightEntered, releasePreflight;
      const enteredPreflight = new Promise((resolve) => {
        preflightEntered = resolve;
      });
      context.providers.checkContext = async () => {
        preflightEntered();
        await new Promise((resolve) => {
          releasePreflight = resolve;
        });
        return null;
      };
      try {
        const cancelled = js(
          `window.workspace.generate({requestId:'managed-cancel-preflight',sessionId:${JSON.stringify(active)},mode:'chat',question:'Cancelled before saving'}).then(()=>'',error=>error.message)`,
        );
        await enteredPreflight;
        await js(`window.workspace.cancel('managed-cancel-preflight')`);
        releasePreflight();
        check(
          'Cancellation during native preflight preserves entries and releases the runtime',
          Boolean(await cancelled) &&
            repositories.sessions.get(active).entries.length === capacityBefore &&
            localManager.runtimes.llm.users === 0,
        );
      } finally {
        releasePreflight?.();
        context.providers.checkContext = originalPreflight;
      }
      check(
        'Managed local Whisper transcribes through renderer IPC',
        (await js(
          `window.workspace.transcribe({sessionId:${JSON.stringify(active)},speaker:'ME',bytes:new Uint8Array([82,73,70,70]).buffer,mime:'audio/wav'})`,
        )) === 'Managed Whisper fixture transcript',
      );
      const productivity = repositories.sessions.create('Productivity fixture', 'general');
      repositories.entries.add(productivity.id, 'transcript', 'Use a bounded queue and launch on Friday.', 'ME');
      context.setActive(productivity.id);
      context.changed();
      await openSession(productivity.id);
      try {
        for (let i = 0; i < 18; i++)
          repositories.entries.add(
            productivity.id,
            i % 2 ? 'assistant' : 'user',
            'Compaction fixture ' + i + ' ' + 'context '.repeat(70),
          );
        const originalCount = repositories.sessions.get(productivity.id).entries.length;
        check(
          'Compaction runs through the real preload with the managed local model',
          (await js(
            `window.workspace.generate({requestId:'compact-native',sessionId:${JSON.stringify(productivity.id)},mode:'compact'})`,
          )) === 'Managed local fixture answer' && repositories.sessions.get(productivity.id).compaction.count === 1,
        );
        check(
          'Compaction preserves original searchable entries',
          repositories.sessions.get(productivity.id).entries.length === originalCount &&
            repositories.sessionSearch.list('Compaction fixture 0').some((session) => session.id === productivity.id),
        );
        await js(`window.workspace.undoCompaction(${JSON.stringify(productivity.id)})`);
        check(
          'Native undo restores the uncompacted context',
          repositories.sessions.get(productivity.id).compaction.count === 0,
        );
        saveSettings({ autoCompact: true, compactThreshold: 1000 });
        await js(
          `window.workspace.generate({requestId:'auto-compact-native',sessionId:${JSON.stringify(productivity.id)},mode:'chat',question:'What did we decide?'})`,
        );
        check(
          'Automatic compaction runs before a long-session answer',
          repositories.sessions.get(productivity.id).compaction.count > 0 &&
            repositories.sessions.get(productivity.id).entries.length === originalCount + 2,
        );
        repositories.entries.add(productivity.id, 'assistant', 'Review the bounded queue before launch.');
        repositories.entries.add(productivity.id, 'assistant', 'Confirm the Friday rollout owner.');
        saveSettings({ autoCompact: false, notchEnabled: true, stealthMode: true });
        const notch = [...privacy.windows].find(([, role]) => role === 'notch')?.[0];
        check(
          'Retired Notch launcher stays hidden while preserving native protection',
          Boolean(notch) &&
            !notch.isVisible() &&
            notch.isContentProtected() &&
            notch.getTitle() === '' &&
            notch.getContentSize()[0] === 84,
        );
        context.expandNotch(true);
        await ready(notch);
        await settle();
        check(
          'Notch expands into protected insight controls',
          notch.isContentProtected() &&
            notch.getContentSize()[0] === 400 &&
            (await notch.webContents.executeJavaScript(
              `Boolean(document.querySelector('[aria-label="Notch assistant"]'))`,
            )),
        );
        await fs.writeFile(path.join(output, 'notch-expanded.png'), (await notch.webContents.capturePage()).toPNG());
        await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Previous insight"]').click()`);
        await settle();
        const reading = await notch.webContents.executeJavaScript(
          `document.querySelector('[aria-label="Notch assistant"] .assistant-response').textContent`,
        );
        await fs.writeFile(
          path.join(output, 'notch-reading-history.png'),
          (await notch.webContents.capturePage()).toPNG(),
        );
        notch.webContents.send('overlay:answer', {
          requestId: 'background-insight',
          sessionId: productivity.id,
          text: 'New background insight: verify the bounded queue.',
        });
        await settle();
        check(
          'New Notch insight preserves the older item being read',
          (await notch.webContents.executeJavaScript(
            `document.querySelector('[aria-label="Notch assistant"] .assistant-response').textContent`,
          )) === reading,
        );
        await fs.writeFile(
          path.join(output, 'notch-new-insight-preserved.png'),
          (await notch.webContents.capturePage()).toPNG(),
        );
        for (
          let i = 0;
          i < 20 &&
          (await notch.webContents.executeJavaScript(
            `!document.querySelector('[aria-label="Notch assistant"] .assistant-response').textContent.includes('New background insight')`,
          ));
          i++
        ) {
          await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Next insight"]').click()`);
          await wait(30);
        }
        check(
          'Explicit Notch navigation advances to the newest insight',
          await notch.webContents.executeJavaScript(
            `document.querySelector('[aria-label="Notch assistant"] .assistant-response').textContent.includes('New background insight')`,
          ),
        );
        await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Previous insight"]').click()`);
        await settle();
        await js(
          `window.workspace.generate({requestId:'notch-visible-ack',sessionId:${JSON.stringify(productivity.id)},mode:'chat',question:'Verify display acknowledgement.'})`,
        );
        await settle();
        check(
          'Notch leaves a new display acknowledgement pending while reading history',
          context.getNotchDisplay().pending?.id === 'notch-visible-ack' &&
            context.getNotchDisplay().displayed?.id !== 'notch-visible-ack',
        );
        const foreignAck = await js(
          `window.workspace.displayNotchInsight('notch-visible-ack').then(()=>false,error=>error.message.includes('Invalid Notch request'))`,
        );
        check(
          'Main window cannot acknowledge a Notch insight',
          foreignAck && context.getNotchDisplay().pending?.id === 'notch-visible-ack',
        );
        for (
          let i = 0;
          i < 20 &&
          (await notch.webContents.executeJavaScript(
            `document.querySelector('[aria-label="Next insight"]')?.disabled===false`,
          ));
          i++
        ) {
          await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Next insight"]').click()`);
          await wait(30);
        }
        await until(() => context.getNotchDisplay().displayed?.id === 'notch-visible-ack');
        check(
          'Notch acknowledges only after the latest answer is displayed',
          context.getNotchDisplay().pending === null &&
            context.getNotchDisplay().displayed?.sessionId === productivity.id,
        );
        await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
        await settle();
        check(
          'Notch collapses back without dropping protection',
          notch.getContentSize()[0] === 84 && notch.isContentProtected() && !notch.isVisible(),
        );
        await js(
          `window.workspace.generate({requestId:'notch-collapsed-ack',sessionId:${JSON.stringify(productivity.id)},mode:'chat',question:'Verify collapsed display acknowledgement.'})`,
        );
        await settle();
        const collapsedAck = await notch.webContents.executeJavaScript(
          `window.workspace.displayNotchInsight('notch-collapsed-ack')`,
        );
        check(
          'Collapsed Notch cannot acknowledge unseen content',
          collapsedAck === false && context.getNotchDisplay().pending?.id === 'notch-collapsed-ack',
        );
        context.expandNotch(true);
        await until(() => context.getNotchDisplay().displayed?.id === 'notch-collapsed-ack');
        check('Expanding Notch acknowledges the pending latest answer', context.getNotchDisplay().pending === null);
        await notch.webContents.executeJavaScript(`document.querySelector('[aria-label="Collapse Notch"]').click()`);
        await settle();
        context.expandNotch(true);
        await settle();
        const notchMetadata = JSON.parse(
          await new Promise((resolve, reject) =>
            execFile(
              '/usr/bin/swift',
              [
                process.env.LEARNTRANSCRIBER_SMOKE_PROBE ||
                  path.resolve(__dirname, '../../scripts/capture-protection-probe.swift'),
                String(process.pid),
              ],
              { timeout: 10000 },
              (error, stdout) => (error ? reject(error) : resolve(stdout)),
            ),
          ),
        );
        check(
          'macOS excludes the protected Notch panel from window sharing',
          notchMetadata.some(
            (window) => window.id === Number(notch.getMediaSourceId().split(':')[1]) && window.sharingState === 0,
          ),
        );
        saveSettings({ notchEnabled: false, stealthMode: false });
        await settingsTab('Controls');
        // The tab records keys; the custom shortcut is saved through the same settings IPC it uses.
        await js(
          `window.workspace.settings({shortcuts:JSON.stringify({capture:{accelerator:'Control+Alt+Shift+F20',enabled:true}})})`,
        );
        await settle();
        const shortcutState = await js('window.workspace.state()');
        check(
          'Custom shortcuts persist and report native registration status',
          shortcutState.shortcutDefinitions.find((item) => item.id === 'capture').accelerator ===
            'Control+Alt+Shift+F20' && typeof shortcutState.privacy.shortcutStatus.capture === 'boolean',
        );
        let duplicateRejected = false;
        try {
          await js(
            `window.workspace.settings({shortcuts:JSON.stringify({capture:{accelerator:'Control+Alt+Shift+F21',enabled:true},ask:{accelerator:'Control+Alt+Shift+F21',enabled:true}})})`,
          );
        } catch {
          duplicateRejected = true;
        }
        check(
          'Duplicate shortcuts cannot overwrite the working configuration',
          duplicateRejected && repositories.settings.read().shortcuts.includes('F20'),
        );
        await openSession(productivity.id);
        await settle();
        // Only a reader's gesture pauses following (content growth never does), so the fixture scrolls up by wheel.
        await js(
          `(()=>{const viewport=document.querySelector('[data-session-chat] [data-slot="scroll-area-viewport"]');viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true}));viewport.scrollTop=0;viewport.dispatchEvent(new Event('scroll',{bubbles:true}));})()`,
        );
        await settle();
        repositories.entries.add(productivity.id, 'assistant', 'Follower fixture while reading history');
        context.changed();
        await settle();
        check(
          'Auto-scroll pauses while the user reads older responses',
          await js(`document.querySelector('[data-session-chat] [data-slot="scroll-area-viewport"]').scrollTop===0`),
        );
        await js(
          `(()=>{const viewport=document.querySelector('[data-session-chat] [data-slot="scroll-area-viewport"]');viewport.scrollTop=viewport.scrollHeight;viewport.dispatchEvent(new Event('scroll',{bubbles:true}));})()`,
        );
        await settle();
        repositories.entries.add(productivity.id, 'assistant', 'Follower fixture after returning to bottom');
        context.changed();
        await settle();
        check(
          'Auto-scroll resumes when returning to the bottom',
          await js(
            `(()=>{const v=document.querySelector('[data-session-chat] [data-slot="scroll-area-viewport"]');return v.scrollHeight-v.scrollTop-v.clientHeight<40;})()`,
          ),
        );
        saveSettings({
          shortcuts: '{}',
          liveTranscription: true,
          systemAudio: false,
          autoInsights: false,
          sessionTimer: true,
        });
        await settle();
        await js(
          `(()=>{window.__liveOriginalMedia=navigator.mediaDevices.getUserMedia;window.__liveMedia={tracks:[],contexts:[]};navigator.mediaDevices.getUserMedia=async()=>{const audio=new AudioContext(),source=audio.createOscillator(),destination=audio.createMediaStreamDestination();source.connect(destination);source.start();window.__liveMedia.contexts.push(audio);window.__liveMedia.tracks.push(...destination.stream.getTracks());return destination.stream;};})()`,
        );
        await openSession(productivity.id);
        const beforeLive = repositories.sessions.get(productivity.id).entries.length;
        await click('Start listening');
        for (let i = 0; i < 150 && !(await js(`Boolean(document.querySelector('[aria-label="Live captions"]'))`)); i++)
          await wait(30);
        check(
          'Local live captions exercise the production microphone worklet and preload',
          await js(
            `document.querySelector('[aria-label="Live captions"]')?.textContent.includes('Managed Whisper fixture transcript')`,
          ),
        );
        check(
          'Draft captions are not stored as completed transcript entries',
          repositories.sessions.get(productivity.id).entries.length === beforeLive,
        );
        const languageBefore = repositories.settings.read().language;
        // The settings no longer carry live language controls; the workspace changes it through the same IPC.
        await js(
          `window.workspace.updateLiveLanguage({sessionId:${JSON.stringify(productivity.id)},language:'pt',prompt:'Kubernetes, PostgreSQL'})`,
        );
        const liveSettings = context.liveTranscription.sessions.get(mainWindow.webContents.id)?.settings;
        check(
          'Live language controls update the active Whisper session without restarting or changing saved defaults',
          liveSettings?.language === 'pt' &&
            liveSettings?.transcriptionPrompt === 'Kubernetes, PostgreSQL' &&
            repositories.settings.read().language === languageBefore &&
            context.liveTranscription.sessions.size === 1,
        );
        const foreignLanguageError = await overlay.webContents.executeJavaScript(
          `window.workspace.updateLiveLanguage({sessionId:${JSON.stringify(productivity.id)},language:'en'}).then(()=>'',error=>error.message)`,
        );
        check(
          'Another native window cannot change an unowned live transcription session',
          foreignLanguageError.includes('no longer active') && liveSettings.language === 'pt',
        );
        await openSession(productivity.id);
        await js(
          `window.workspace.pushLiveAudio({sessionId:${JSON.stringify(productivity.id)},speaker:'THEY',samples:new Int16Array(16000).fill(1000).buffer})`,
        );
        await js(
          `window.workspace.pushLiveAudio({sessionId:${JSON.stringify(productivity.id)},speaker:'THEY',samples:new Int16Array(16000).buffer})`,
        );
        await click('Mute microphone');
        for (let i = 0; i < 150 && repositories.sessions.get(productivity.id).entries.length < beforeLive + 2; i++)
          await wait(30);
        await click('Stop listening');
        const savedLive = repositories.sessions.get(productivity.id).entries.slice(beforeLive);
        check(
          'Live transcription finalizes once per source and preserves ME/THEY labels',
          savedLive.length === 2 &&
            savedLive.some((entry) => entry.speaker === 'ME') &&
            savedLive.some((entry) => entry.speaker === 'THEY'),
        );
        check(
          'Stopping live captions releases microphone tracks and the Whisper lease',
          context.liveTranscription.sessions.size === 0 &&
            !localManager.runtimes.whisper.users &&
            (await js(`window.__liveMedia.tracks.every(track=>track.readyState==='ended')`)),
        );
        await fs.writeFile(
          path.join(output, 'productivity-session.png'),
          (await mainWindow.webContents.capturePage()).toPNG(),
        );
        notch.destroy();
      } finally {
        await context.liveTranscription.stop(mainWindow.webContents.id, true);
        saveSettings({
          autoCompact: false,
          notchEnabled: false,
          stealthMode: false,
          liveTranscription: false,
          sessionTimer: false,
          shortcuts: '{}',
        });
        await js(
          `(async()=>{if(window.__liveOriginalMedia)navigator.mediaDevices.getUserMedia=window.__liveOriginalMedia;for(const audio of window.__liveMedia?.contexts||[])await audio.close();})()`,
        );
        context.setActive(active);
        repositories.sessions.delete(productivity.id);
        await openSession(active);
      }
      await js("window.workspace.stopLocalModel('llm')");
      await js("window.workspace.stopLocalModel('whisper')");
      check(
        'Managed servers stop through native controls',
        Object.values(localManager.state().runtimes).every((r) => r.status === 'stopped'),
      );
    } finally {
      await localManager.stop('llm');
      await localManager.stop('whisper');
      localManager.spawn = originalSpawn;
      saveSettings({ provider: 'custom', model: 'fixture-model', transcriptionProvider: 'custom' });
    }
    const contextSession = repositories.sessionSearch.list()[0].id;
    context.setActive(contextSession);
    context.changed();
    await openSession(contextSession);
    check(
      'Selection review targets the active native session',
      await eventually(() =>
        js(`(async()=> (await window.workspace.state()).activeSessionId===${JSON.stringify(contextSession)})()`),
      ),
    );
    const beforeContext = repositories.sessions.get(contextSession).context.length;
    const originalSelection = context.nativeContext.selection;
    let selectedFixture = 'Initial selection';
    context.nativeContext.selection = async () => ({ text: selectedFixture, application: 'Controlled fixture' });
    const restoreCapture = context.setCapture(() => mainWindow.webContents.capturePage());
    try {
      const ocr = await js('window.workspace.screenText()');
      check(
        'Native Apple Vision extracts text from the app fixture window through IPC',
        ocr.text.includes('LearnTranscriber'),
      );
      await attachAction('Extract screen text');
      for (let i = 0; i < 100 && !(await js('Boolean(document.querySelector("#context-preview"))')); i++)
        await wait(30);
      check(
        'OCR context is reviewable and not saved automatically',
        (await js('document.querySelector("#context-preview").value.includes("bounded queue")')) &&
          repositories.sessions.get(contextSession).context.length === beforeContext,
      );
      await click('Discard text');
      saveSettings({ autoSelection: true });
      await wait(50);
      selectedFixture = 'Selected fixture <img src=x onerror=alert(1)>';
      await context.selectionWatcher.tick();
      await wait(50);
      check(
        'New selections prepare escaped review text without executing markup',
        await eventually(() =>
          js(
            'Boolean(document.querySelector("#context-preview")?.value.includes("<img src=x")) && !document.querySelector("main img")',
          ),
        ),
      );
      saveSettings({ autoSelection: false });
      await input('#context-preview', 'Reviewed bounded queue context');
      await input('#chat-input', 'Use my reviewed context');
      await click('Send question');
      await until(() => reviewedContextSeen);
      await settle();
      check(
        'Reviewed text is consumed only by the explicit question',
        reviewedContextSeen &&
          (await js('!document.querySelector("#context-preview")')) &&
          repositories.sessions.get(contextSession).context.length === beforeContext,
      );
      const beforeAutomatic = repositories.sessions
        .get(contextSession)
        .entries.filter((e) => e.kind === 'assistant').length;
      // Screen insights follow live insights since they were coupled to the realtime modes, so both are on here.
      saveSettings({ autoSelection: true, autoScreenInsights: true, autoInsights: true });
      await wait(50);
      selectedFixture = 'Automatic bounded queue screen context';
      await context.selectionWatcher.tick();
      await until(
        () =>
          repositories.sessions.get(contextSession).entries.filter((e) => e.kind === 'assistant').length >
          beforeAutomatic,
      );
      check(
        'Opt-in screen insights generate only after a new selection',
        repositories.sessions.get(contextSession).entries.filter((e) => e.kind === 'assistant').length ===
          beforeAutomatic + 1,
      );
      saveSettings({ autoSelection: false, autoScreenInsights: false, autoInsights: false });
      const beforeQuick = repositories.sessions
        .get(contextSession)
        .entries.filter((entry) => entry.kind === 'assistant').length;
      saveSettings({ quickScreenshot: true });
      await js("window.workspace.dispatchShortcut('capture')");
      for (
        let i = 0;
        i < 100 &&
        repositories.sessions.get(contextSession).entries.filter((entry) => entry.kind === 'assistant').length ===
          beforeQuick;
        i++
      )
        await wait(30);
      check(
        'Quick screenshot action goes through renderer IPC and submits a controlled capture',
        repositories.sessions.get(contextSession).entries.filter((entry) => entry.kind === 'assistant').length ===
          beforeQuick + 1 && (await js(`!document.querySelector('img[alt="Attached display capture"]')`)),
      );
      saveSettings({ quickScreenshot: false });

      const assets = await js('window.workspace.speechAssets()');
      check(
        'Apple Speech language inventory loads without installation or authorization prompts',
        typeof assets.assetManagementAvailable === 'boolean',
      );
      let denied = false;
      try {
        await js("window.workspace.manageSpeechLocale({operation:'install',locale:'en-US'})");
      } catch {
        denied = true;
      }
      check('Language mutation is blocked while a session is active', denied);
    } finally {
      saveSettings({ autoSelection: false });
      context.nativeContext.selection = originalSelection;
      restoreCapture();
    }
    context.setActive(s.id);
    saveSettings({
      provider: 'custom',
      model: 'fixture-model',
      systemAudio: true,
      systemAudioSource: 'native',
      transcriptionProvider: 'custom',
    });
    const originalAudioSpawn = context.systemAudio.spawn;
    context.systemAudio.spawn = (executable, args, options) =>
      require('node:child_process').spawn(executable, [...args, '--self-test'], options);
    try {
      await js(
        `(()=>{window.nativeAudioPacket=new Promise((resolve,reject)=>{const unsubscribe=window.workspace.onSystemAudio(segment=>{unsubscribe();window.workspace.transcribe(segment).then(resolve,reject);});});return true;})()`,
      );
      await js(`window.workspace.startSystemAudio(${JSON.stringify(s.id)})`);
      check(
        'Bundled native audio synthetic PCM reaches transcription through IPC',
        (await js('window.nativeAudioPacket')) === 'Transcribed fixture audio.',
      );
      await js('window.workspace.stopSystemAudio()');
      check('Native audio helper stops without leaving a child process', context.systemAudio.child === null);
    } finally {
      await context.systemAudio.stop();
      context.systemAudio.spawn = originalAudioSpawn;
      saveSettings({ systemAudio: false });
    }
    const originalChatGPTFetch = context.chatgptAuth.fetch,
      originalChatGPTBrowser = context.chatgptAuth.openBrowser,
      originalProviderFetch = context.providers.fetch;
    const { publicKey: identityPublic, privateKey: identityPrivate } = require('node:crypto').generateKeyPairSync(
      'rsa',
      { modulusLength: 2048 },
    );
    let chatgptAuthorization, chatgptRequest;
    context.chatgptAuth.openBrowser = async (value) => {
      chatgptAuthorization = new URL(value);
      const callback = new URL(chatgptAuthorization.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', chatgptAuthorization.searchParams.get('state'));
      callback.searchParams.set('code', 'native-chatgpt-code');
      callback.searchParams.set('client_id', 'oaiapp_native_fixture');
      await fetch(callback);
    };
    context.chatgptAuth.fetch = async (url, options) => {
      const target = String(url);
      if (target.endsWith('/.well-known/openid-configuration'))
        return Response.json({
          issuer: 'https://auth.openai.com',
          jwks_uri: 'https://auth.openai.com/fixture-jwks',
          revocation_endpoint: 'https://auth.openai.com/fixture-revoke',
        });
      if (target.endsWith('/fixture-jwks'))
        return Response.json({
          keys: [{ ...identityPublic.export({ format: 'jwk' }), kid: 'native-fixture', alg: 'RS256' }],
        });
      if (target.endsWith('/fixture-revoke')) return new Response('', { status: 200 });
      const fields = new URLSearchParams(options.body);
      assert.equal(fields.get('client_id'), 'oaiapp_native_fixture');
      assert.equal(
        require('node:crypto').createHash('sha256').update(fields.get('code_verifier')).digest('base64url'),
        chatgptAuthorization.searchParams.get('code_challenge'),
      );
      const encoded =
        Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'native-fixture' })).toString('base64url') +
        '.' +
        Buffer.from(
          JSON.stringify({
            iss: 'https://auth.openai.com',
            aud: 'oaiapp_native_fixture',
            exp: Date.now() / 1000 + 3600,
            sub: 'native-subject',
            email: 'fixture@example.invalid',
            nonce: chatgptAuthorization.searchParams.get('nonce'),
          }),
        ).toString('base64url');
      return Response.json({
        access_token: 'native-fixture-chatgpt-token',
        refresh_token: 'native-fixture-chatgpt-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid resource.invoke chatgpt.tokens.use.direct',
        id_token:
          encoded +
          '.' +
          require('node:crypto').sign('sha256', Buffer.from(encoded), identityPrivate).toString('base64url'),
      });
    };
    context.providers.fetch = async (url, options) => {
      if (String(url) === 'https://api.openai.com/v1/models')
        return Response.json({ models: [{ slug: 'native-chatgpt-model', visibility: 'list' }] });
      if (String(url) === 'https://api.openai.com/v1/responses') {
        chatgptRequest = JSON.parse(options.body);
        return new Response(
          'data: ' +
            JSON.stringify({ type: 'response.output_text.delta', delta: 'ChatGPT fixture answer' }) +
            '\n\ndata: ' +
            JSON.stringify({ type: 'response.completed', response: { status: 'completed' } }) +
            '\n\n',
        );
      }
      return originalProviderFetch(url, options);
    };
    try {
      await go('settings/ai/sources/openai');
      check(
        'OpenAI source page mounts its API key field',
        await eventually(() => js("Boolean(document.querySelector('#openai-api-key'))")),
      );
      await input('#openai-api-key', 'fixture-unsaved-provider-key');
      await go('settings/ai/sources/gemini');
      check(
        'Gemini source page mounts its API key field',
        await eventually(() => js("Boolean(document.querySelector('#gemini-api-key'))")),
      );
      check(
        'Changing provider clears an unsaved key before it can be sent to another service',
        await js("document.querySelector('#gemini-api-key').value === ''"),
      );
      await go('settings/ai/sources/openai');
      await click('Sign in with ChatGPT');
      for (let i = 0; i < 100; i++) {
        if (
          (await context.chatgptAuth.state()).accounts.some((a) => a.authenticated) &&
          !context.chatgptAuth.loginPromise
        )
          break;
        await wait(30);
      }
      check(
        'ChatGPT sign-in completes validated registration from the native UI',
        (await context.chatgptAuth.state()).accounts.some((a) => a.authenticated),
      );
      check(
        'ChatGPT sign-in offers the authenticated model picker',
        await eventually(() => js("Boolean(document.querySelector('#codex-model-select'))")),
      );
      await press("document.querySelector('#codex-model-select')");
      await press(
        "[...document.querySelectorAll('[role=option]')].find(item=>item.textContent.trim()==='native-chatgpt-model')",
      );
      check(
        'Choosing the authenticated model selects the ChatGPT provider',
        await eventually(() => repositories.settings.read().provider === 'chatgpt'),
      );
      const models = await js('window.workspace.models()');
      check('ChatGPT model catalog uses the authenticated provider', models.includes('native-chatgpt-model'));
      check(
        'ChatGPT inference uses Responses with store disabled and terminal completion',
        (await js(
          `window.workspace.generate({requestId:'chatgpt-native',sessionId:${JSON.stringify(s.id)},mode:'chat',question:'ChatGPT fixture question'})`,
        )) === 'ChatGPT fixture answer' && chatgptRequest.store === false,
      );
      check(
        'ChatGPT credentials stay encrypted outside renderer state',
        !JSON.stringify(await js('window.workspace.state()')).includes('native-fixture-chatgpt-token') &&
          !Buffer.from(repositories.credentials.get('chatgpt')).includes(Buffer.from('native-fixture-chatgpt-token')),
      );
      await js("document.querySelector('#codex-model-select').scrollIntoView({block:'center'})");
      await wait(50);
      await fs.writeFile(path.join(output, 'chatgpt-1280.png'), (await mainWindow.webContents.capturePage()).toPNG());
      const account = (await context.chatgptAuth.state()).activeId;
      const logout = await js(`window.workspace.logoutChatGPT(${JSON.stringify(account)})`);
      check(
        'ChatGPT sign-out attempts remote revocation and clears active access',
        logout.revoked && (await context.chatgptAuth.state()).activeId === null,
      );
    } finally {
      context.chatgptAuth.fetch = originalChatGPTFetch;
      context.chatgptAuth.openBrowser = originalChatGPTBrowser;
      context.providers.fetch = originalProviderFetch;
      saveSettings({ provider: 'custom', model: 'fixture-model' });
    }
    const formattedResponse =
      '## Completed decision\n\n- Keep **evidence**.\n- Use `queue`.\n\n| Action | Owner |\n| --- | --- |\n| Test | Me |\n\n```js\nconst first = 1;\n```\n\n```python\nsecond = 2\n```\n\n[Documentation](https://example.com/docs)\n\n<script>window.unsafeResponse=true</script>\n\n![remote](https://example.com/tracker.png)';
    const formatted = repositories.entries.add(s.id, 'assistant', formattedResponse);
    context.changed();
    await openSession(s.id);
    const responseSelector = `[data-response="${formatted.id}"]`;
    check(
      'Completed responses render lists, tables and two independently copyable code blocks',
      await js(
        `(()=>{const row=document.querySelector(${JSON.stringify(responseSelector)});return row.querySelectorAll('[data-code-block]').length===2&&Boolean(row.querySelector('table'))&&Boolean(row.querySelector('ul'))&&!row.querySelector('script,img')&&!window.unsafeResponse;})()`,
      ),
    );
    const nativeClipboard = require('electron').clipboard,
      originalClipboardWrite = nativeClipboard.writeText;
    let copiedCode;
    nativeClipboard.writeText = (value) => {
      copiedCode = value;
    };
    try {
      await press(
        `document.querySelector(${JSON.stringify(responseSelector)}).querySelectorAll('[data-code-block]')[0].querySelector('[aria-label="Copy code"]')`,
      );
      check(
        'Code Copy sends only the selected code through native IPC and scopes its feedback',
        copiedCode === 'const first = 1;\n' &&
          (await js(
            `(()=>{const blocks=document.querySelector(${JSON.stringify(responseSelector)}).querySelectorAll('[data-code-block]');return blocks[0].textContent.includes('Copied')&&!blocks[1].textContent.includes('Copied');})()`,
          )),
      );
      nativeClipboard.writeText = () => {
        throw new Error('Synthetic clipboard failure');
      };
      await press(
        `document.querySelector(${JSON.stringify(responseSelector)}).querySelectorAll('[data-code-block]')[1].querySelector('[aria-label="Copy code"]')`,
      );
      check(
        'Failed clipboard writes show a recoverable error without successful copy feedback',
        await js(
          `(()=>{const block=document.querySelector(${JSON.stringify(responseSelector)}).querySelectorAll('[data-code-block]')[1];return block.textContent.includes('Could not copy')&&!block.textContent.includes('Copied');})()`,
        ),
      );
    } finally {
      nativeClipboard.writeText = originalClipboardWrite;
    }
    check(
      'Response formatting preserves the original stored answer',
      repositories.sessions.get(s.id).entries.find((entry) => entry.id === formatted.id).content === formattedResponse,
    );
    await js(`document.querySelector(${JSON.stringify(responseSelector)}).scrollIntoView({block:'start'})`);
    await settle();
    await fs.writeFile(
      path.join(output, 'formatted-response.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    await overlay.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Floating assistant views"] button:nth-child(2)')?.click()`,
    );
    const streamFixture = () =>
      overlay.webContents.send('overlay:delta', {
        requestId: 'format-stream',
        delta: 'Partial **answer**\n\n```js\nconst incomplete =',
      });
    check(
      'Floating response keeps incomplete fences as plain text while streaming',
      await eventually(() => {
        streamFixture();
        return wait(25).then(() =>
          overlay.webContents.executeJavaScript(
            "(()=>{const response=document.querySelector('[data-response-streaming]');return Boolean(response)&&!response.querySelector('[data-code-block]')})()",
          ),
        );
      }),
    );
    const completedFixture = () =>
      overlay.webContents.send('overlay:answer', {
        requestId: 'format-stream',
        text: formattedResponse,
        sessionId: s.id,
      });
    check(
      'Floating assistant shares completed Markdown and code rendering',
      await eventually(() => {
        completedFixture();
        return wait(25).then(() =>
          overlay.webContents.executeJavaScript(
            "document.querySelectorAll('[data-code-block]').length===2&&Boolean(document.querySelector('table'))",
          ),
        );
      }),
    );
    await settle();
    check(
      'Floating session offers assistant-guided follow-ups after a saved answer',
      // Wait for the saved answer and its explicit follow-up action before testing the workspace controls.
      await eventually(() =>
        overlay.webContents.executeJavaScript(
          "Boolean([...document.querySelectorAll('[aria-label=\"Suggested questions\"] button')].find(item=>item.textContent==='Suggested questions'))",
        ),
      ),
    );
    await overlay.webContents.executeJavaScript(
      "document.querySelector('[aria-label=\"Suggested questions\"]')?.scrollIntoView({block:'end'});window.getSelection()?.removeAllRanges();document.activeElement?.blur()",
    );
    await settle();
    const beforeSuggestions = repositories.sessions.get(s.id).entries.length;
    await click('Load follow-ups');
    await click('Cancel suggestions');
    await wait(300);
    check(
      'Cancelled follow-up generation cannot display late suggestions',
      await js(
        "!document.querySelector('[aria-label=\"Suggested questions\"]').textContent.includes('Review the queue design')",
      ),
    );
    await click('Load follow-ups');
    await wait(300);
    check(
      'Follow-up generation displays model suggestions without changing conversation entries',
      (await js(
        "document.querySelector('[aria-label=\"Suggested questions\"]').textContent.includes('Review the queue design')",
      )) && repositories.sessions.get(s.id).entries.length === beforeSuggestions,
    );
    await js("document.querySelector('[aria-label=\"Suggested questions\"]').scrollIntoView({block:'center'})");
    await settle();
    await fs.writeFile(
      path.join(output, 'follow-up-suggestions.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    await press(
      `[...document.querySelectorAll('[aria-label="Suggested questions"] button')].find(button=>button.textContent==='Review the queue design')`,
    );
    await wait(400);
    check(
      'Clicking a suggestion submits its full prompt and receives a normal answer',
      repositories.sessions
        .get(s.id)
        .entries.some(
          (entry) => entry.kind === 'user' && entry.content === 'Explain the bounded queue validation plan.',
        ) && repositories.sessions.get(s.id).entries.at(-1).content === 'Fixture answer: use a bounded queue.',
    );
    check(
      'A new short answer clears previous suggestions and disables generation',
      await js(
        "(()=>{const group=document.querySelector('[aria-label=\"Suggested questions\"]');return !group.textContent.includes('Review the queue design')&&[...group.querySelectorAll('button')].find(button=>button.textContent==='Load follow-ups').disabled;})()",
      ),
    );
    const layouts = [];
    for (const width of [1280, 700]) {
      mainWindow.setContentSize(width, 800);
      await wait(60);
      for (const route of ['home', 'session', 'sessions', 'assistants', 'settings', 'privacy', 'tools']) {
        await go(route);
        await wait(50);
        const layout = await js(
          `({width:innerWidth,documentWidth:document.documentElement.scrollWidth,route:${JSON.stringify(route)}})`,
        );
        layouts.push(layout);
        check(`Native layout fits ${route} at ${width}`, layout.documentWidth <= layout.width);
        await fs.writeFile(
          path.join(output, `${route}-${width}.png`),
          (await mainWindow.webContents.capturePage()).toPNG(),
        );
      }
    }
    for (const width of [1280, 700]) {
      mainWindow.setContentSize(width, 800);
      // Local models are chosen in the Models tab; the settings no longer carry a download form.
      await settingsTab('AI setup');
      await wait(60);
      check(`Local model settings fit at ${width}`, await js('document.documentElement.scrollWidth<=innerWidth'));
      await fs.writeFile(
        path.join(output, `local-models-${width}.png`),
        (await mainWindow.webContents.capturePage()).toPNG(),
      );
    }
    // Translation has no settings controls of its own; its provider and model are saved through the settings IPC.
    await js(
      `window.workspace.settings({translationProvider:'custom',translationModel:'translation-fixture',translationLanguage:'es'})`,
    );
    await settle();
    check(
      'Translation model and provider save independently from analysis',
      repositories.settings.read().translationModel === 'translation-fixture' &&
        repositories.settings.read().translationProvider === 'custom',
    );
    await js(
      `window.workspace.generate({requestId:'translation-separate',sessionId:${JSON.stringify(s.id)},mode:'translation'})`,
    );
    check('Translation with separate settings is persisted', Boolean(repositories.sessions.get(s.id).translation));
    const participant = repositories.sessions
      .get(s.id)
      .entries.find((entry) => entry.kind === 'transcript' && entry.speaker === 'THEY');
    const beforeEntryTranslation = repositories.sessions.get(s.id);
    const translated = await js(
      `window.workspace.translateEntry({requestId:'entry-translation-native',sessionId:${JSON.stringify(s.id)},entryId:${JSON.stringify(participant.id)},language:${JSON.stringify(repositories.settings.read().translationLanguage)}})`,
    );
    check(
      'Per-message native translation uses the separate model without changing saved entries',
      translated.text === 'Fixture translation: use a bounded queue.' &&
        lastTranslationRequest?.model === 'translation-fixture' &&
        lastTranslationRequest.messages[1].content === participant.content &&
        JSON.stringify(repositories.sessions.get(s.id)) === JSON.stringify(beforeEntryTranslation),
    );
    await openSession(s.id);
    await click('Transcript');
    for (
      let i = 0;
      i < 100 &&
      !(await js(
        "document.querySelector('[data-transcript-id]')?.textContent.includes('Fixture translation: use a bounded queue.')",
      ));
      i++
    )
      await wait(30);
    check(
      'Transcript shows participant translation while preserving the original ME row',
      (await js(
        "document.querySelector('[data-transcript-id]')?.textContent.includes('Fixture translation: use a bounded queue.')",
      )) &&
        (await js(
          "[...document.querySelectorAll('[data-transcript-id]')].some(row=>row.textContent.includes('Transcribed fixture audio.'))",
        )),
    );
    await click('Show originals');
    check(
      'Original toggle restores the participant speech',
      await js(
        "document.querySelector('[data-transcript-id]')?.textContent.includes('We decided to use a bounded queue.')",
      ),
    );
    mainWindow.setContentSize(1280, 800);
    await go('settings/ai/sources/apple_speech');
    await wait(400);
    await fs.writeFile(path.join(output, 'audio-local-1280.png'), (await mainWindow.webContents.capturePage()).toPNG());
    await settingsTab('Controls');
    await wait(50);
    await fs.writeFile(path.join(output, 'context-1280.png'), (await mainWindow.webContents.capturePage()).toPNG());
    mainWindow.setContentSize(700, 800);
    await wait(50);
    check(
      'Context controls fit the minimum window width',
      await js('document.documentElement.scrollWidth<=innerWidth'),
    );
    await fs.writeFile(path.join(output, 'context-700.png'), (await mainWindow.webContents.capturePage()).toPNG());
    const selectedBeforeImport = repositories.settings.read().assistantId,
      sessionAssistantBeforeImport = repositories.sessions.get(s.id).assistant_id;
    const assistantBar = [...context.privacy.windows.keys()].find((window) =>
      window.webContents.getURL().includes('surface=bar'),
    );
    const openAssistantLibrary = async () => {
      await ready(assistantBar);
      await assistantBar.webContents.executeJavaScript(
        `document.querySelector('[role="combobox"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}))`,
      );
      check(
        'Floating assistant picker offers assistant management',
        await eventually(() =>
          assistantBar.webContents.executeJavaScript(
            `Boolean([...document.querySelectorAll('[role="option"]')].find(item=>item.textContent.trim()==='Manage assistants'))`,
          ),
        ),
      );
      await assistantBar.webContents.executeJavaScript(
        `[...document.querySelectorAll('[role="option"]')].find(item=>item.textContent.trim()==='Manage assistants').click()`,
      );
      check(
        'Floating management opens the assistant library',
        await eventually(() => js("location.hash==='#assistants'")),
      );
    };
    await openAssistantLibrary();
    await menuAction('More ways to add', 'Import prompt');
    for (
      let i = 0;
      i < 100 &&
      !(await js(`Boolean(document.querySelector('[role="dialog"] input[aria-label="Markdown assistant file"]'))`));
      i++
    )
      await wait(30);
    check(
      'Assistant management offers Markdown import in the workspace',
      await js(
        `location.hash==='#assistants'&&Boolean(document.querySelector('[role="dialog"] input[aria-label="Markdown assistant file"]'))`,
      ),
    );
    await wait(250);
    await fs.writeFile(
      path.join(output, 'assistant-md-import.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    const markdownFixture = '# Review\n\nUse evidence.';
    await js(
      `(()=>{const picker=document.querySelector('input[aria-label="Markdown assistant file"]');const files=new DataTransfer();files.items.add(new File([${JSON.stringify(markdownFixture)}],'review-helper.md',{type:'text/markdown'}));picker.files=files.files;picker.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    for (
      let i = 0;
      i < 100 &&
      !(await js(`Boolean(document.querySelector('[role="dialog"]')?.textContent.includes('Review assistant'))`));
      i++
    )
      await wait(30);
    check(
      'Markdown review shows only name and system prompt',
      await eventually(() =>
        js(
          `(()=>{const dialog=document.querySelector('[role="dialog"]');if(!dialog?.textContent.includes('Started from review-helper.md'))return false;const labels=[...dialog.querySelectorAll('label')];return labels.some(label=>label.querySelector('span')?.textContent==='Name'&&label.querySelector('input')?.value==='review-helper')&&labels.some(label=>label.querySelector('span')?.textContent==='System prompt'&&label.querySelector('textarea')?.value===${JSON.stringify(markdownFixture)})&&labels.length===2&&!dialog.textContent.includes('Follow-up suggestions prompt')&&!dialog.textContent.includes('Email summary prompt');})()`,
        ),
      ),
    );
    await wait(250);
    await fs.writeFile(
      path.join(output, 'assistant-md-review.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    await click('Save assistant', `document.querySelector('[role="dialog"]')`);
    check(
      'Saved Markdown assistant is available to the floating bar without changing the active session',
      repositories.assistants
        .all()
        .some(
          (item) =>
            item.name === 'review-helper' &&
            item.prompt === markdownFixture &&
            item.realtime_prompt === '' &&
            item.follow_up_prompt === '' &&
            item.email_prompt === '',
        ) &&
        repositories.settings.read().assistantId === selectedBeforeImport &&
        repositories.sessions.get(s.id).assistant_id === sessionAssistantBeforeImport &&
        (await assistantBar.webContents.executeJavaScript(
          `window.workspace.state().then(state=>state.assistants.some(item=>item.name==='review-helper'))`,
        )),
    );
    await openAssistantLibrary();
    await click('New assistant');
    check(
      'New assistant opens editable name category and instructions fields',
      await eventually(() =>
        js(
          `(()=>{const dialog=document.querySelector('[role="dialog"]');return Boolean(dialog)&&['Name','Category','System instructions'].every(name=>[...dialog.querySelectorAll('label')].some(label=>label.querySelector('span')?.textContent===name));})()`,
        ),
      ),
    );
    await field('Name', 'Study assistant');
    await field('Category', 'Education');
    await field('System instructions', 'Help the user learn. Ask for their reasoning before explaining.');
    check(
      'Editing an assistant does not persist it before Save',
      !repositories.assistants.all().some((item) => item.name === 'Study assistant'),
    );
    await fs.writeFile(
      path.join(output, 'assistant-create-review.png'),
      (await mainWindow.webContents.capturePage()).toPNG(),
    );
    await click('Save assistant', `document.querySelector('[role="dialog"]')`);
    check(
      // Since #24 a newly created assistant becomes the one new sessions use; the open session keeps its own.
      'Saved assistant keeps its category and instructions, becomes the one in use, and leaves the session binding',
      (await eventually(() =>
        repositories.assistants
          .all()
          .some(
            (item) =>
              item.name === 'Study assistant' &&
              item.category === 'Education' &&
              item.prompt === 'Help the user learn. Ask for their reasoning before explaining.' &&
              item.realtime_prompt === '' &&
              item.follow_up_prompt === '',
          ),
      )) &&
        repositories.settings.read().assistantId ===
          repositories.assistants.all().find((item) => item.name === 'Study assistant')?.id &&
        repositories.sessions.get(s.id).assistant_id === sessionAssistantBeforeImport,
    );
    const selectedAfterCreate = repositories.settings.read().assistantId;
    await click('New assistant');
    await field('Name', 'Discarded assistant fixture');
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))`);
    check(
      'Closing an unsaved assistant discards it and preserves the session binding',
      (await eventually(() => js(`!document.querySelector('[role="dialog"]')`))) &&
        !repositories.assistants.all().some((item) => item.name === 'Discarded assistant fixture') &&
        repositories.settings.read().assistantId === selectedAfterCreate &&
        repositories.sessions.get(s.id).assistant_id === sessionAssistantBeforeImport,
    );
    check('Renderer contains no runtime console errors', errors.length === 0);
    await fs.writeFile(
      path.join(output, 'result.json'),
      JSON.stringify(
        {
          passed: true,
          checks,
          environment: { electron: process.versions.electron, node: process.versions.node, platform: process.platform },
          limitations: [
            'Provider and audio bytes are controlled fixtures; microphone/system audio and external providers are not exercised.',
            'Native protection flags do not prove capture exclusion in Teams, Zoom or Meet.',
          ],
          layouts,
          consoleErrors: errors,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await fs.writeFile(path.join(output, 'failure.html'), await js('document.documentElement.outerHTML'));
    await fs.writeFile(path.join(output, 'failure.png'), (await mainWindow.webContents.capturePage()).toPNG());
    await fs.writeFile(
      path.join(output, 'result.json'),
      JSON.stringify(
        { passed: false, checks, error: error.message, stack: error.stack, consoleErrors: errors },
        null,
        2,
      ),
    );
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    context.quit();
  }
}
module.exports = { run };
