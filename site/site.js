// Motion for the presentation page. The hero pins the Mac while three situations scroll by: an online class, a team
// meeting and a programming tutorial. In each, sound runs into the bar, the transcript arrives, a question is typed and
// sent, the answer is written out, and the saved session flies to the card beside the Mac. With reduced motion each
// scene shows its finished state.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const header = $('[data-top]');
const markScrolled = () => header.toggleAttribute('data-scrolled', window.scrollY > 12);
markScrolled();
window.addEventListener('scroll', markScrolled, { passive: true });

// The navigation is the app's floating bar: the pill names the section on screen, the way the app's picker names the
// assistant, and opens the full list; the keys jump to the main sections and light up while their section is on screen.
const dockPill = $('[data-dock-pill]');
const dockMenu = $('[data-dock-menu]');
const dockLabel = $('[data-dock-label]');
const dockLinks = $$('.dock a[href^="#"]').filter((link) => link.getAttribute('href').length > 1);
const dockSections = [...new Set(dockLinks.map((link) => link.getAttribute('href')))]
  .map((href) => ({ href, section: $(href), name: $(`.dock__menu a[href="${href}"]`).textContent.trim() }))
  .filter(({ section }) => section);
function openDockMenu(open) {
  dockMenu.hidden = !open;
  dockPill.setAttribute('aria-expanded', String(open));
}
dockPill.addEventListener('click', () => openDockMenu(dockMenu.hidden));
dockMenu.addEventListener('click', (event) => {
  if (event.target.closest('a')) openDockMenu(false);
});
document.addEventListener('click', (event) => {
  if (!dockMenu.hidden && !event.target.closest('.dock__picker')) openDockMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dockMenu.hidden) {
    openDockMenu(false);
    dockPill.focus();
  }
});
let dockCurrent = null;
function markDock() {
  const line = window.innerHeight * 0.4;
  const current = dockSections.filter(({ section }) => section.getBoundingClientRect().top <= line).pop() || null;
  if (current === dockCurrent) return;
  dockCurrent = current;
  dockLabel.textContent = current ? current.name : 'LearnTranscriber';
  if (!reduced)
    dockLabel.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ],
      260,
    );
  for (const link of dockLinks) {
    if (current && link.getAttribute('href') === current.href) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}
markDock();
window.addEventListener('scroll', markDock, { passive: true });

const story = $('[data-story]');
const demoScreen = $('[data-demo]');
const feed = $('[data-feed]');
const compose = $('[data-compose]');
const send = $('[data-send]');
const toast = $('[data-toast]');
const timer = $('[data-timer]');
const placeholder = compose.textContent;

const scenes = [
  {
    app: 'Classroom',
    assistant: ['#a-english', 'English Assistant'],
    source: '.obj--phones',
    saved: ['English class · present perfect', 'Saved · 52 min · summary ready'],
    toast: '<b>Session saved</b> · summary ready',
    script: [
      {
        kind: 'they',
        text: 'We use the present perfect for experiences, like “I have visited Lisbon twice.”',
        wait: 700,
      },
      {
        kind: 'they',
        text: 'And with “for” or “since” when something started in the past and is still true.',
        wait: 1800,
      },
      {
        kind: 'insight',
        text: 'Present perfect: have or has plus the past participle, for experiences and things that are still true.',
        wait: 1400,
      },
      { kind: 'ask', text: 'When do I use “for” or “since”?', wait: 1600 },
      {
        kind: 'answer',
        text: '“For” takes a length of time, like for three years. “Since” takes a starting point, like since 2023: I have studied English since 2023.',
        wait: 700,
      },
    ],
  },
  {
    app: 'Video call',
    assistant: ['#a-meeting', 'Note Taker'],
    source: '.obj--mic',
    saved: ['Team sync · beta launch', 'Saved · 34 min · decisions and next steps'],
    toast: '<b>Summary saved</b> · decisions and next steps',
    script: [
      { kind: 'they', text: 'So the beta goes out to the first 50 users next Friday.', wait: 700 },
      { kind: 'they', text: 'Leo, can you finish the onboarding screens by Wednesday?', wait: 1800 },
      {
        kind: 'insight',
        text: 'Decision: the beta goes to the first 50 users next Friday. Leo owns onboarding, due Wednesday.',
        wait: 1400,
      },
      { kind: 'ask', text: 'What did we decide about the beta?', wait: 1600 },
      {
        kind: 'answer',
        text: 'It ships to the first 50 users next Friday, and Leo finishes the onboarding screens by Wednesday.',
        wait: 700,
      },
    ],
  },
  {
    app: 'Code',
    assistant: ['#a-programming', 'Programming Assistant'],
    source: '.obj--board',
    saved: ['React tutorial · useEffect', 'Saved · 18 min · notes ready'],
    toast: '<b>Session saved</b> · notes ready',
    script: [
      { kind: 'they', text: 'Now we fetch the user inside useEffect and keep it in state.', wait: 700 },
      {
        kind: 'they',
        text: 'The id goes in the dependency array, so it fetches again when the id changes.',
        wait: 1800,
      },
      {
        kind: 'insight',
        text: 'useEffect runs after render; with [id] it runs again only when the id changes.',
        wait: 1400,
      },
      { kind: 'ask', text: 'Why does this log run twice in development?', shot: true, wait: 1600 },
      {
        kind: 'answer',
        text: 'React’s Strict Mode mounts components twice in development to catch missing cleanups, so the effect runs twice. A production build runs it once per id.',
        wait: 700,
      },
    ],
  },
];

function line(kind, text, { shot = false } = {}) {
  const item = document.createElement('div');
  item.className = `line line--${kind}`;
  const labels = {
    they: '<span class="who">THEY</span>',
    insight: '<span class="label"><i></i>Insight</span>',
    answer: '<span class="label">Assistant</span>',
  };
  const attached = shot ? '<span class="line__shot"><svg><use href="#i-capture" /></svg>Screenshot</span>' : '';
  item.innerHTML = `${labels[kind] || ''}${attached}<span class="text"></span>`;
  item.querySelector('.text').textContent = text;
  return item;
}

let heroVisible = true;
let runToken = 0;

// A playing scene stops as soon as another one starts: every wait reports whether its run is still the current one.
async function waitFor(ms, token) {
  await pause(ms);
  while (token === runToken && !heroVisible) await pause(200);
  return token === runToken;
}

async function write(target, text, token) {
  target.classList.add('caret');
  for (let index = 2; index < text.length + 2; index += 2) {
    if (!(await waitFor(28, token))) return false;
    target.textContent = text.slice(0, index);
  }
  target.classList.remove('caret');
  return true;
}

function resetComposer() {
  compose.classList.remove('is-typing');
  compose.textContent = placeholder;
  send.classList.remove('is-pressed', 'is-ready');
}

async function ask(step, token) {
  compose.classList.add('is-typing');
  compose.textContent = '';
  for (let index = 1; index <= step.text.length; index += 1) {
    if (!(await waitFor(55, token))) return false;
    compose.textContent = step.text.slice(0, index);
    if (index === 1) send.classList.add('is-ready');
  }
  if (!(await waitFor(320, token))) return false;
  send.classList.add('is-pressed');
  if (!(await waitFor(150, token))) return false;
  resetComposer();
  feed.append(line('you', step.text, { shot: step.shot }));
  return true;
}

// The saved session leaves the panel and lands on the card beside the Mac, which then answers with a small nudge.
async function flyToSaved() {
  const target = $('.float--saved');
  if (!target || target.offsetParent === null) return;
  const from = toast.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'flight';
  chip.innerHTML = '<svg class="glyph"><use href="#a-star" /></svg>';
  document.body.append(chip);
  const start = { x: from.left + 4, y: from.top + from.height / 2 - 22 };
  const end = { x: to.left + 12, y: to.top + to.height / 2 - 22 };
  const lift = { x: start.x + (end.x - start.x) * 0.35, y: Math.min(start.y, end.y) - 60 };
  await chip.animate(
    [
      { transform: `translate(${start.x}px, ${start.y}px) scale(0.5)`, opacity: 0 },
      { transform: `translate(${start.x}px, ${start.y - 10}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${lift.x}px, ${lift.y}px) scale(1.08)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${end.x}px, ${end.y}px) scale(1)`, opacity: 1 },
    ],
    { duration: 1300, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
  ).finished;
  chip.remove();
  target.animate([{ scale: 1 }, { scale: 1.07 }, { scale: 1 }], {
    duration: 520,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  });
}

async function play(scene) {
  const token = ++runToken;
  while (token === runToken) {
    feed.replaceChildren();
    for (const step of scene.script) {
      if (!(await waitFor(step.wait, token))) return;
      if (step.kind === 'they') {
        demoScreen.setAttribute('data-speaking', '');
        feed.append(line('they', step.text));
        const going = await waitFor(1500, token);
        demoScreen.removeAttribute('data-speaking');
        if (!going) return;
      } else if (step.kind === 'ask') {
        if (!(await ask(step, token))) return;
      } else {
        const item = line(step.kind, '');
        if (step.kind === 'insight') item.classList.add('is-new');
        feed.append(item);
        if (!(await write(item.querySelector('.text'), step.text, token))) return;
      }
    }
    if (!(await waitFor(1600, token))) return;
    toast.classList.add('is-on');
    if (!(await waitFor(500, token))) return;
    await flyToSaved();
    if (!(await waitFor(2200, token))) return;
    toast.classList.remove('is-on');
    if (!(await waitFor(900, token))) return;
    await feed.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' }).finished;
  }
}

function showFinished(scene) {
  feed.replaceChildren(
    ...scene.script.map((step) => {
      const item = line(step.kind === 'ask' ? 'you' : step.kind, step.text, { shot: step.shot });
      item.style.animation = 'none';
      return item;
    }),
  );
}

// Sound paths from each visible source down the screen's left margin and into the recording bar.
function drawLinks() {
  const svg = $('[data-links]');
  const box = $('.stage').getBoundingClientRect();
  const bar = $('.bar__controls').getBoundingClientRect();
  const screen = demoScreen.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.innerHTML = $$('[data-source]')
    .filter((source) => source.offsetParent !== null)
    .map((source, index) => {
      const card = source.getBoundingClientRect();
      const x1 = card.right - box.left - 8;
      const y1 = card.top + card.height / 2 - box.top;
      const lane = screen.left - box.left + screen.width * 0.011 + index * 5;
      const x2 = bar.left - box.left + 6;
      const y2 = bar.top - box.top + bar.height / 2 + (index - 1) * 4;
      const turn = 18;
      const down = y2 > y1 ? 1 : -1;
      const f = (value) => value.toFixed(1);
      const active = source.hasAttribute('data-active') ? ' class="is-active"' : '';
      return `<path${active} d="M${f(x1)} ${f(y1)} C ${f(lane)} ${f(y1)}, ${f(lane)} ${f(y1)}, ${f(lane)} ${f(y1 + down * turn)} L ${f(lane)} ${f(y2 - down * turn)} Q ${f(lane)} ${f(y2)}, ${f(lane + turn)} ${f(y2)} L ${f(x2)} ${f(y2)}"/>`;
    })
    .join('');
}

let current = -1;
function setScene(index) {
  if (index === current) return;
  current = index;
  const scene = scenes[index];
  $$('[data-scene]').forEach((layer) => layer.classList.toggle('is-on', Number(layer.dataset.scene) === index));
  $$('[data-scene-tab]').forEach((tab) => {
    const on = Number(tab.dataset.sceneTab) === index;
    tab.classList.toggle('is-on', on);
    tab.setAttribute('aria-pressed', String(on));
  });
  $('[data-scene-app]').textContent = scene.app;
  $('[data-scene-glyph]').setAttribute('href', scene.assistant[0]);
  $('[data-scene-assistant]').textContent = scene.assistant[1];
  $('[data-saved-title]').textContent = scene.saved[0];
  $('[data-saved-meta]').textContent = scene.saved[1];
  $('[data-toast-text]').innerHTML = scene.toast;
  $$('[data-chip]').forEach((chip) => chip.classList.toggle('is-active', Number(chip.dataset.chip) === index));
  $$('[data-source]').forEach((source) => source.toggleAttribute('data-active', source.matches(scene.source)));
  // Only the scene on screen plays its footage.
  $$('[data-scene] video').forEach((video) => {
    if (!reduced && Number(video.closest('[data-scene]').dataset.scene) === index) video.play().catch(() => {});
    else video.pause();
  });
  toast.classList.remove('is-on');
  demoScreen.removeAttribute('data-speaking');
  resetComposer();
  drawLinks();
  if (reduced) showFinished(scene);
  else play(scene);
}

// The story's scroll progress picks the scene; the tabs scroll to the start of theirs.
function sceneFromScroll() {
  const total = story.offsetHeight - window.innerHeight;
  const progress = Math.min(1, Math.max(0, -story.getBoundingClientRect().top / total));
  return Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
}
window.addEventListener('scroll', () => setScene(sceneFromScroll()), { passive: true });
$$('[data-scene-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    const total = story.offsetHeight - window.innerHeight;
    const top = story.offsetTop + total * ((Number(tab.dataset.sceneTab) + 0.1) / scenes.length);
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  }),
);

setScene(sceneFromScroll());
window.addEventListener('resize', () => drawLinks());

// Choose your assistant: each tab shows that assistant's sample answer. While the section is on screen the tabs take
// turns on their own, until someone picks one.
const pickTabs = $$('[data-pick] [role="tab"]');
const pickPanel = (tab) => $(`#${tab.getAttribute('aria-controls')}`);
let picked = 0;
let pickChosen = false;
let pickStream = 0;

// Each word of an answer gets its place in the order, so the panel can stream it in the way the app writes answers.
$$('.pick__a p').forEach((answer) => {
  let count = 0;
  const wrap = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE) return wrap(child);
      const words = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) return words.append(part);
        const word = document.createElement('span');
        word.className = 'w';
        word.style.setProperty('--i', count++);
        word.textContent = part;
        words.append(word);
      });
      child.replaceWith(words);
    });
  };
  wrap(answer);
  answer.dataset.words = count;
});
function streamAnswer(panel) {
  if (reduced) return;
  clearTimeout(pickStream);
  $$('.pick__panel').forEach((other) => other.classList.remove('is-streaming', 'is-waiting'));
  void panel.offsetWidth; // restarts the animations when the same panel streams again
  panel.classList.add('is-streaming');
  const words = Number($('.pick__a p', panel).dataset.words);
  pickStream = setTimeout(() => panel.classList.remove('is-streaming'), 240 + words * 22 + 300);
}

function pick(index) {
  if (index === picked) return;
  const from = pickTabs[picked];
  const to = pickTabs[index];
  from.setAttribute('aria-selected', 'false');
  from.tabIndex = -1;
  to.setAttribute('aria-selected', 'true');
  to.tabIndex = 0;
  pickPanel(from).classList.remove('is-on');
  const panel = pickPanel(to);
  panel.classList.add('is-on');
  if (!reduced) panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  streamAnswer(panel);
  picked = index;
}
pickTabs.forEach((tab, index) => {
  tab.tabIndex = index === picked ? 0 : -1;
  tab.addEventListener('click', () => {
    pickChosen = true;
    pick(index);
  });
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    pickChosen = true;
    pick((picked + step + pickTabs.length) % pickTabs.length);
    pickTabs[picked].focus();
  });
});
if (!reduced) {
  let pickVisible = false;
  let pickReading = false;
  new IntersectionObserver(
    ([entry]) => {
      pickVisible = entry.isIntersecting;
    },
    { threshold: 0.4 },
  ).observe($('.pick'));
  // The first answer waits until the panel is in view, then streams in.
  pickPanel(pickTabs[picked]).classList.add('is-waiting');
  const firstStream = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      firstStream.disconnect();
      streamAnswer(pickPanel(pickTabs[picked]));
    },
    { threshold: 0.5 },
  );
  firstStream.observe($('.pick__chat'));
  // Pointing at the answer holds it, so it doesn't change while someone reads it.
  $('.pick__panels').addEventListener('pointerenter', () => {
    pickReading = true;
  });
  $('.pick__panels').addEventListener('pointerleave', () => {
    pickReading = false;
  });
  setInterval(() => {
    if (pickVisible && !pickReading && !pickChosen) pick((picked + 1) % pickTabs.length);
  }, 6500);
}

// Built in the open: the padlock and its cards tilt a little toward the pointer, and settle back when it leaves.
const openScene = $('[data-open] .open__scene');
if (openScene && !reduced) {
  const openSection = $('[data-open]');
  openSection.addEventListener('pointermove', (event) => {
    const box = openScene.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    openScene.style.setProperty('--ry', `${(x * 18).toFixed(1)}deg`);
    openScene.style.setProperty('--rx', `${(-y * 14).toFixed(1)}deg`);
  });
  openSection.addEventListener('pointerleave', () => {
    openScene.style.setProperty('--ry', '0deg');
    openScene.style.setProperty('--rx', '0deg');
  });
}

// How it works: the floating bar and panel, drawn in 3D, go through one session as the page scrolls, one step at a
// time. A phase is the state at the start of a step, so a step reached by a fast scroll, or shown with reduced motion,
// still has everything that came before it.
const flow = $('[data-flow]');
const rig = $('[data-rig]');
const flowSteps = $$('[data-flow-step]');
const flowCursor = $('[data-cursor]');
const flowLines = $$('[data-flow-line]', rig);
const flowQuestion = $('[data-flow-q]', rig);
const flowAnswer = $('[data-flow-a]', rig);
const flowAsk = $('[data-flow-ask]', rig);
const flowTimer = $('[data-flow-timer]', rig);
const flowEngine = $('[data-flow-engine]', rig);
const flowModel = $('[data-flow-model]', rig);
const askHint = flowAsk.textContent;
// Tilt in degrees and zoom for each step: close on the bar while picking and pressing, wider once the panel is open.
const cameras = [
  [18, -16, 1.35],
  [20, -10, 1.4],
  [12, -8, 1],
  [10, -6, 1],
  [12, -12, 1],
  [16, -20, 0.96],
];
const exchanges = [
  [
    'When do I use “for” or “since”?',
    '“For” takes a length of time, like for three years. “Since” takes a starting point, like since 2023.',
  ],
  [
    'Is the example on this slide right?',
    'Yes. “I have lived here since 2020” uses “since” with a starting point, so the present perfect fits.',
  ],
];
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
let flowStep = -1;
let flowRun = 0;
let flowSeconds = 0;
let flowPending = false;

function flowPhase(phase) {
  rig.classList.remove('is-picking');
  rig.classList.toggle('is-listening', phase >= 2 && phase <= 5);
  rig.classList.toggle('has-panel', phase >= 3);
  rig.classList.toggle('has-answer', phase >= 4);
  rig.classList.toggle('has-slide', phase >= 5);
  rig.classList.toggle('is-saved', phase >= 6);
  flowLines.forEach((line) => (line.textContent = phase >= 3 ? line.dataset.flowLine : ''));
  [flowQuestion.textContent, flowAnswer.textContent] = phase >= 5 ? exchanges[1] : phase >= 4 ? exchanges[0] : ['', ''];
  flowAsk.textContent = askHint;
  flowAsk.parentElement.classList.remove('is-typing');
  flowEngine.textContent = 'Apple Speech';
  flowModel.textContent = 'ChatGPT';
  if (phase < 2) flowSeconds = 0;
  flowTimer.textContent = clock(flowSeconds);
}

async function flowType(element, text, token, delay) {
  for (let length = 1; length <= text.length; length += 1) {
    if (token !== flowRun) return false;
    element.textContent = text.slice(0, length);
    await pause(delay);
  }
  return token === flowRun;
}

// The pointer glides to a control on the rig and presses it.
async function flowClick(target, token) {
  const box = target.getBoundingClientRect();
  const stage = flowCursor.parentElement.getBoundingClientRect();
  flowCursor.style.translate = `${box.left + box.width * 0.55 - stage.left}px ${box.top + box.height * 0.6 - stage.top}px`;
  flowCursor.classList.add('is-on');
  await pause(760);
  if (token !== flowRun) return false;
  flowCursor.classList.add('is-down');
  target.classList.add('is-pressed');
  await pause(170);
  flowCursor.classList.remove('is-down');
  target.classList.remove('is-pressed');
  return token === flowRun;
}

async function flowCycle(element, values, token) {
  for (const value of values) {
    if (token !== flowRun) return;
    element.textContent = value;
    element.parentElement.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 320 });
    await pause(900);
  }
}

async function flowAskQuestion([question, answer], token, withSlide) {
  const ask = flowAsk.parentElement;
  ask.classList.add('is-typing');
  if (!(await flowType(flowAsk, question, token, 30))) return;
  if (!(await flowClick($('[data-flow-send]', rig), token))) return;
  ask.classList.remove('is-typing');
  flowAsk.textContent = askHint;
  rig.classList.toggle('has-slide', withSlide);
  flowAnswer.textContent = '';
  flowQuestion.textContent = question;
  rig.classList.add('has-answer');
  await pause(500);
  await flowType(flowAnswer, answer, token, 16);
}

async function flowAct(step, token) {
  // Waits for the camera to settle, so the pointer lands where the control ends up.
  await pause(1000);
  if (token !== flowRun) return;
  if (step === 0) {
    if (!(await flowClick($('[data-flow-picker]', rig), token))) return;
    rig.classList.add('is-picking');
    const items = $$('.rig__item', rig);
    for (const index of [2, 1, 0]) {
      if (token !== flowRun) return;
      items.forEach((item, position) => item.classList.toggle('is-hover', position === index));
      await pause(420);
    }
    if (await flowClick(items[0], token)) rig.classList.remove('is-picking');
  } else if (step === 1) {
    if (await flowClick($('[data-flow-mic]', rig), token)) rig.classList.add('is-listening');
  } else if (step === 2) {
    flowCursor.classList.remove('is-on');
    rig.classList.add('has-panel');
    flowCycle(flowEngine, ['Whisper, local', 'Cloud service', 'Apple Speech'], token);
    for (const line of flowLines) {
      if (!(await flowType(line, line.dataset.flowLine, token, 26))) return;
    }
  } else if (step === 3) {
    flowCycle(flowModel, ['Your API key', 'Local model', 'ChatGPT'], token);
    await flowAskQuestion(exchanges[0], token, false);
  } else if (step === 4) {
    if (!(await flowClick($('[data-flow-capture]', rig), token))) return;
    const flash = $('.rig__flash', rig);
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
    await flowAskQuestion(exchanges[1], token, true);
  } else if (await flowClick($('[data-flow-mic]', rig), token)) {
    rig.classList.remove('is-listening');
    rig.classList.add('is-saved');
  }
}

function setFlowStep(step, engaged) {
  if (step !== flowStep) {
    flowStep = step;
    flowRun += 1;
    flowSteps.forEach((item, index) => item.classList.toggle('is-on', index === step));
    const [rx, ry, zoom] = cameras[step];
    rig.style.setProperty('--rx', `${rx}deg`);
    rig.style.setProperty('--ry', `${ry}deg`);
    rig.style.setProperty('--zoom', zoom);
    $$('.rig__item', rig).forEach((item) => item.classList.remove('is-hover'));
    flowPhase(reduced ? step + 1 : step);
    flowPending = !reduced;
  }
  // A step is acted out only once the section is pinned, so nothing plays while it is still off screen.
  if (flowPending && engaged) {
    flowPending = false;
    flowAct(step, flowRun);
  }
}

function flowFromScroll() {
  const box = flow.getBoundingClientRect();
  // Below the viewport the section starts over, so coming back down plays the first step again.
  if (box.top > window.innerHeight) {
    flowStep = -1;
    flowRun += 1;
    return;
  }
  const total = flow.offsetHeight - window.innerHeight;
  const progress = Math.min(1, Math.max(0, -box.top / total));
  flow.style.setProperty('--flow-progress', progress.toFixed(3));
  const engaged = box.top <= window.innerHeight * 0.25 && box.bottom >= window.innerHeight * 0.75;
  setFlowStep(Math.min(flowSteps.length - 1, Math.floor(progress * flowSteps.length)), engaged);
}
window.addEventListener('scroll', flowFromScroll, { passive: true });
flowFromScroll();
setInterval(() => {
  if (!rig.classList.contains('is-listening')) return;
  flowSeconds += 1;
  flowTimer.textContent = clock(flowSeconds);
}, 1000);

// Works with what you use: the title lights up word by word as it scrolls into view, and the floating assistant hops
// from app to app while the section is on screen, until someone clicks an app to send it there.
const reach = $('.reach');
const reachTitle = $('[data-words]', reach);
reachTitle.replaceChildren(
  ...reachTitle.textContent.split(' ').flatMap((text, index) => {
    const word = document.createElement('span');
    word.textContent = text;
    return index ? [' ', word] : [word];
  }),
);
const reachWords = $$('span', reachTitle);
const reachApps = $$('[data-app]', reach);
const reachFloat = $('[data-reach-float]', reach);
const reachStops = [
  ['#a-english', 'English Assistant', '“Since” takes a starting point, like since 2023.'],
  ['#a-programming', 'Programming Assistant', 'Strict Mode runs effects twice in development.'],
  ['#a-meeting', 'Note Taker', 'Decision: the beta ships on Friday.'],
  ['#a-general', 'General Assistant', 'Product-led growth: the product itself brings users in.'],
];
let reachAt = 0;

function lightReach() {
  const box = reach.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - box.top) / (window.innerHeight * 0.55)));
  reachWords.forEach((word, index) => {
    word.style.opacity = reduced ? 1 : Math.min(1, Math.max(0.15, progress * reachWords.length - index + 0.15));
  });
}

function hopReach(index) {
  reachAt = index;
  reachApps.forEach((app, position) => {
    app.classList.toggle('is-on', position === index);
    app.setAttribute('aria-pressed', String(position === index));
  });
  const [glyph, name, answer] = reachStops[index];
  $('[data-reach-glyph]', reach).setAttribute('href', glyph);
  $('[data-reach-name]', reach).textContent = name;
  $('[data-reach-answer]', reach).textContent = answer;
  const stage = reachFloat.parentElement.getBoundingClientRect();
  const app = reachApps[index].getBoundingClientRect();
  const left = app.left - stage.left + app.width / 2 - reachFloat.offsetWidth / 2;
  reachFloat.style.setProperty('--fx', `${Math.max(0, Math.min(left, stage.width - reachFloat.offsetWidth))}px`);
  reachFloat.style.setProperty('--fy', `${app.bottom - stage.top - 34}px`);
  if (!reduced) reachFloat.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 500 });
}

let reachChosen = false;
reachApps.forEach((app, index) =>
  app.addEventListener('click', () => {
    reachChosen = true;
    hopReach(index);
  }),
);
lightReach();
hopReach(0);
window.addEventListener('scroll', lightReach, { passive: true });
window.addEventListener('resize', () => hopReach(reachAt));
if (!reduced) {
  let reachVisible = false;
  new IntersectionObserver(
    ([entry]) => {
      reachVisible = entry.isIntersecting;
    },
    { threshold: 0.4 },
  ).observe(reach);
  setInterval(() => {
    if (reachVisible && !reachChosen) hopReach((reachAt + 1) % reachApps.length);
  }, 2800);
}

if (!reduced) {
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
  }).observe(demoScreen);

  // Drawn again once the objects have popped in, so the paths start at their resting place.
  setTimeout(drawLinks, 1700);

  let seconds = 12 * 60 + 4;
  setInterval(() => {
    if (!heroVisible) return;
    seconds += 1;
    timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);

  // The objects around the Mac lean with the pointer, each by its own depth.
  const stage = $('.stage');
  const floats = $$('.float');
  stage.addEventListener('pointermove', (event) => {
    const box = stage.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    for (const float of floats) {
      const depth = Number(float.dataset.depth || 0.5);
      float.style.setProperty('--px', `${(-x * 18 * depth).toFixed(1)}px`);
      float.style.setProperty('--py', `${(-y * 14 * depth).toFixed(1)}px`);
    }
  });
  stage.addEventListener('pointerleave', () => {
    for (const float of floats) {
      float.style.setProperty('--px', '0px');
      float.style.setProperty('--py', '0px');
    }
  });
}
