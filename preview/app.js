const sessions = [
  { title: 'Planning a personal assistant', date: 'Today', duration: '18 min', text: 'Capture the conversation, keep the context, and turn decisions into clear next steps.', assistant: 'General assistant' },
  { title: 'Architecture study session', date: 'Yesterday', duration: '32 min', text: 'Comparing a local-first workflow with optional cloud model providers.', assistant: 'Study companion' },
  { title: 'Weekly project review', date: 'Monday', duration: '24 min', text: 'Reviewing the prototype and collecting feedback for the next iteration.', assistant: 'Meeting notes' }
];
const assistants = [
  {name:'General assistant',icon:'✳',description:'Ask questions, understand your screen, and work with the context of your conversation.'},
  {name:'Study companion',icon:'◇',description:'Explore a topic step by step. Explain unfamiliar terms and collect useful study notes.'},
  {name:'Meeting notes',icon:'≡',description:'Keep track of decisions, questions and next steps throughout a conversation.'}
];
let currentAssistant = 0;
let sessionTab = 'transcript';
let settingsTab = 'providers';
let paused = false;
let searchQuery = '';
let timer;
const main = document.querySelector('#main');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (text, action, primary = false) => `<button class="button${primary ? ' primary' : ''}" data-action="${action}">${text}</button>`;
const sample = '<span class="sample-label">Example</span>';
function toast(message) {
  const box = document.querySelector('#toast');
  box.textContent = message;
  box.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => box.classList.remove('visible'), 4500);
}
function showDialog(content) {
  document.querySelector('#dialog-content').innerHTML = content;
  document.querySelector('#dialog').showModal();
}
function sessionList(query = '') {
  const matching = sessions.filter(s => `${s.title} ${s.text} ${s.assistant}`.toLowerCase().includes(query.toLowerCase()));
  if (!matching.length) return '<p class="empty">No sample sessions match your search.</p>';
  return `<div class="session-list">${matching.map(s => `<a href="#session" class="session-item"><div class="session-top"><strong>${s.title}</strong>${sample}</div><p>${s.text}</p><div class="meta"><span>${s.date}</span><span>${s.duration}</span><span>${s.assistant}</span></div></a>`).join('')}</div>`;
}
function heading(title, description, action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">Your personal workspace</p><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function home() {
  const a = assistants[currentAssistant];
  return `${heading('Ready when you are.', 'A place for your conversations, questions, and ideas.', button('＋ New session','start',true))}
  <div class="home-grid"><div class="stack">
    <section class="panel intro"><h2>Start a conversation</h2><p>Choose how you want to begin.</p>
      <button class="action" data-action="start"><span class="glyph" aria-hidden="true">♩</span><span><strong>Analyze conversation</strong><small>Listen, transcribe, and ask as you go</small></span><span class="arrow">↗</span></button>
      <button class="action" data-action="capture"><span class="glyph" aria-hidden="true">▣</span><span><strong>Capture screen</strong><small>Bring what you see into the conversation</small></span><span class="arrow">↗</span></button>
      <button class="action" data-action="ask"><span class="glyph" aria-hidden="true">✳</span><span><strong>Ask something</strong><small>Start with a question or a thought</small></span><span class="arrow">↗</span></button>
    </section>
    <section class="panel"><div class="panel-heading"><p>Current assistant</p><span class="pill">Personal</span></div><div class="assistant-row"><span class="avatar">${a.icon}</span><div><h3>${a.name}</h3><small>Your instructions. Your context.</small></div></div><div class="assistant-controls"><a class="button" href="#assistants">Switch assistant</a><a class="button subtle" href="#assistants">Manage assistants →</a></div></section>
    <section class="panel"><div class="privacy-line"><span class="glyph" aria-hidden="true">◈</span><p>Your workspace, on your Mac</p></div><p class="tiny">The personal edition will keep session history locally and use the model providers you choose.</p><a class="button subtle" href="#settings" data-setting-link="privacy">Privacy settings →</a></section>
  </div><div class="stack">
    <section class="panel"><div class="panel-heading"><p>Recent sessions</p><a class="button subtle" href="#sessions">View all →</a></div>${sessionList()}</section>
    <section class="panel"><div class="panel-heading"><p>Your AI setup</p><a href="#settings" class="button subtle">Configure →</a></div><div class="connection-row"><span>Assistant model</span><span class="pill">Not connected</span></div><div class="connection-row"><span>Transcription</span><span class="pill">Not configured</span></div><p class="section-note">Bring your own keys, or choose a local model.</p></section>
  </div></div>`;
}
function transcript() {
  return `<div class="transcript-line"><span class="speaker other">THEY</span><div><div class="meta"><span>Other participant</span><span>00:12</span></div><p>What would make a personal assistant useful during a study session?</p></div></div>
  <div class="transcript-line"><span class="speaker">ME</span><div><div class="meta"><span>You</span><span>00:19</span></div><p>I want to stay focused on the conversation. It should keep the transcript and help me understand unfamiliar ideas.</p></div></div>
  <div class="transcript-line"><span class="speaker other">THEY</span><div><div class="meta"><span>Other participant</span><span>00:34</span></div><p>Let's keep everything local where possible, with the option to connect a model using our own key.</p></div></div>
  <div class="wave" aria-label="Static sample audio waveform">${[6,9,15,8,22,31,17,10,27,35,18,11,21,29,16,8,13,24,33,19,10,7,17,25,11,6].map((h,i)=>`<span class="bar-${i}" data-height="${h}"></span>`).join('')}</div><p class="footer-hint">Fictional transcript · No microphone or system audio is being captured.</p>`;
}
function summary() {
  return '<div class="summary"><p class="sample-label">Example summary</p><h3>Overview</h3><p>A discussion about a personal study assistant that preserves context and helps explain unfamiliar topics.</p><h3>Decisions</h3><ul><li>Keep session history on the Mac.</li><li>Allow personal API keys and local model options.</li><li>Make the transcript available alongside the assistant.</li></ul><h3>Next steps</h3><p>Review the session layout, then implement and test audio capture.</p></div>';
}
function session() {
  return `<a class="back-link" href="#sessions">← All sessions</a>${heading('Planning a personal assistant','Example session · General assistant', `<div class="session-toolbar"><span class="listening"><i></i> Preview session</span>${button(paused?'Resume preview':'Pause preview','pause')}${button('End preview','end')}</div>`)}
  <div class="session-layout"><section class="panel"><div class="panel-heading"><h2>Conversation</h2>${sample}</div><div class="tabs" role="tablist" aria-label="Conversation view"><button role="tab" aria-selected="${sessionTab==='transcript'}" data-tab="transcript">Transcript</button><button role="tab" aria-selected="${sessionTab==='summary'}" data-tab="summary">Summary</button><button role="tab" aria-selected="${sessionTab==='translation'}" data-tab="translation">Translation</button></div>${sessionTab==='summary'?summary():sessionTab==='translation'?'<div class="summary"><span class="sample-label">Example translation · Portuguese</span><h3>Outro participante</h3><p>O que tornaria um assistente pessoal útil durante uma sessão de estudo?</p><h3>Você</h3><p>Quero manter o foco na conversa. Ele deve guardar a transcrição e me ajudar a entender ideias desconhecidas.</p></div>':transcript()}</section>
  <section class="panel"><div class="panel-heading"><h2>Ask your assistant</h2><span class="pill">Session context</span></div><small>Example question</small><p style-free="true">What have we decided so far?</p><div class="assistant-answer"><p>Keep the session history on your Mac, and let you choose between personal API keys and local models.</p><p>The transcript and assistant should stay side by side so you can ask about an idea without losing the conversation.</p><p><small>Illustrative response, not generated by a connected model.</small></p></div><div class="followups">${button('List the next steps','followup')}${button('Explain local models','followup')}</div><form id="chat-form" class="chat-compose"><textarea id="chat-input" aria-label="Ask about this session" placeholder="Ask about this session…" rows="2"></textarea><button class="button primary" aria-label="Send preview question">↑</button></form><p class="footer-hint">Preview only. Messages are not sent or saved.</p><div class="section-note">${button('Preview floating assistant ↗','overlay')}${button('Export example','export')}</div></section></div>`;
}
function history() {
  return `${heading('Your sessions','Find a conversation and pick up where you left off.',button('＋ New session','start',true))}<section class="panel"><div class="panel-heading"><h2>Session history</h2><span class="pill">3 examples</span></div><label class="field">Search titles and content<input id="history-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search your sessions…"></label><div id="history-results">${sessionList(searchQuery)}</div></section>`;
}
function assistantPage() {
  return `${heading('Assistants','Different instructions for different kinds of work.',button('＋ Create assistant','create',true))}<div class="assistant-grid">${assistants.map((a,i)=>`<section class="panel assistant-card${i===currentAssistant?' selected':''}"><div class="panel-heading"><span class="avatar">${a.icon}</span>${i===currentAssistant?'<span class="pill">Selected</span>':''}</div><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.description)}</p><div>${button(i===currentAssistant?'Selected':'Use assistant',`select-${i}`,i!==currentAssistant)} ${button('Edit',`edit-${i}`)}</div></section>`).join('')}</div><p class="section-note">Assistant changes in this preview are temporary and reset when you reload.</p>`;
}
function settingsContent() {
  if(settingsTab==='providers') return `<h2>AI sources</h2><p>Choose where your assistant and transcription run.</p><section class="panel"><div class="panel-heading"><h3>Bring your own provider</h3><span class="pill">Not connected</span></div><div class="form-grid"><label class="field">Provider<select id="provider"><option>OpenAI</option><option>Gemini</option><option>OpenRouter</option><option>Custom API</option><option>Local model</option></select></label><label class="field">Assistant model<input placeholder="Choose a model after connecting" disabled></label><label class="field wide">API key<input type="password" placeholder="Key entry is disabled in the preview" disabled autocomplete="off"><small>Credentials will be entered in the native app, not in this design preview.</small></label><label class="field wide">Custom or local endpoint<input placeholder="http://localhost:11434/v1" disabled></label></div>${button('Preview connection flow','connect',true)}</section><section class="panel section-note"><h3>Independent model choices</h3><div class="connection-row"><span>Transcription</span><span>Not configured</span></div><div class="connection-row"><span>Analysis & summaries</span><span>Not configured</span></div><div class="connection-row"><span>Translation</span><span>Not configured</span></div></section>`;
  if(settingsTab==='audio') return `<h2>Audio & transcription</h2><p>Control which side of the conversation you capture.</p><section class="panel"><label class="field">Microphone<select><option>System default · Preview</option></select></label><label class="field">Other participant<select><option>System audio · Preview</option><option>Disabled</option></select></label><label class="field">Transcription engine<select><option>Apple Speech</option><option>Local Whisper</option><option>Cloud transcription</option></select></label><label class="field">Language<select><option>Automatic</option><option>English</option><option>Portuguese (Brazil)</option></select></label>${toggle('Echo reduction','Reduce feedback between the microphone and system audio.')}<p class="section-note">No devices are accessed by this preview. Native audio permissions and engine availability still need testing.</p></section>`;
  if(settingsTab==='privacy') return `<h2>Privacy</h2><p>Control when context is captured and how it is stored.</p><section class="panel">${toggle('Exclude assistant from screen sharing','Planned native behavior; compatibility must be tested with each sharing app.')}${toggle('Click-through overlay','Allow clicks to pass through inactive overlay areas.')}${toggle('Selected-text context','Use an explicitly selected passage as context.')}<div class="setting-row"><div><p>Session storage</p><small>Planned: local searchable history on this Mac.</small></div><span class="pill">Local</span></div><p class="section-note">These switches illustrate the settings layout. They do not change macOS privacy controls.</p></section>`;
  if(settingsTab==='tools') return `<h2>Connected tools</h2><p>Give an assistant access to the tools you explicitly connect.</p><section class="panel">${['Obsidian','Notion','Google Calendar','Google Drive','Custom MCP server'].map(t=>`<div class="setting-row"><div><p>${t}</p><small>Not connected</small></div>${button('Configure','tool')}</div>`).join('')}<p class="section-note">Connections and authorization are not implemented in this preview.</p></section>`;
  return `<h2>Keyboard shortcuts</h2><p>Proposed defaults for the personal edition.</p><section class="panel">${[['Show / hide assistant','⌘ ⇧ Space'],['Start / stop listening','⌘ ⇧ R'],['Capture screen','⌘ ⇧ S'],['Ask a question','⌘ ⇧ A']].map(([a,b])=>`<div class="setting-row"><p>${a}</p><kbd>${b}</kbd></div>`).join('')}<p class="section-note">Illustrative shortcuts. No global shortcuts are registered.</p></section>`;
}
function toggle(title,description) {return `<label class="setting-row"><span><span>${title}</span><small>${description}</small></span><input class="switch" type="checkbox" aria-label="${title}"></label>`;}
function settings() {
  return `${heading('Settings','Make the workspace yours.')}<div class="settings-layout"><div class="settings-nav" role="tablist" aria-label="Settings categories">${[['providers','AI sources'],['audio','Audio & transcription'],['privacy','Privacy'],['shortcuts','Shortcuts'],['tools','Connected tools']].map(([key,label])=>`<button role="tab" aria-selected="${settingsTab===key}" data-setting="${key}">${label}</button>`).join('')}</div><div class="settings-content">${settingsContent()}</div></div>`;
}
function overlay() {
  return `${heading('A little context, within reach.','Floating assistant illustration · Native positioning is not implemented.', '<a class="button" href="#session">Back to session</a>')}<div class="overlay-demo"><div class="notch"><div class="panel-heading"><h3>✳ GENERAL ASSISTANT</h3>${sample}</div><p>Keep the transcript local. Connect your own model when you need help understanding a topic.</p><div class="notch-tools"><small>From your conversation</small>${button('Ask a follow-up','ask')}${button('Open session','start')}</div></div></div><p class="section-note">This illustrates a compact overlay inside the preview. It does not float above other applications.</p>`;
}
function render() {
  const page = location.hash.slice(1) || 'home';
  const pages = {home,sessions:history,session,assistants:assistantPage,settings,overlay};
  main.innerHTML = (pages[page] || home)();
  document.querySelectorAll('.navigation a').forEach(a => {
    const active = a.hash === `#${page==='session'?'sessions':page}`;
    if(active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('.wave span').forEach(bar=>bar.style.height=`${bar.dataset.height}px`);
}
function go(page) {if(location.hash===`#${page}`) render(); else location.hash=page;}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action],[data-tab],[data-setting],[data-setting-link]');
  if(!target) return;
  if(target.dataset.settingLink) settingsTab=target.dataset.settingLink;
  if(target.dataset.tab) {sessionTab=target.dataset.tab;render();return;}
  if(target.dataset.setting) {settingsTab=target.dataset.setting;render();return;}
  const action = target.dataset.action;
  if(action==='start') go('session');
  else if(action==='ask') {go('session');setTimeout(()=>document.querySelector('#chat-input')?.focus(),50);}
  else if(action==='pause') {paused=!paused;render();toast(paused?'Preview paused. No audio was being recorded.':'Preview resumed. No audio is being recorded.');}
  else if(action==='end') showDialog(`<h2>End the preview session?</h2><p>This is sample content. There is no recording to stop or transcript to save.</p><div class="dialog-actions">${button('Back to home','confirm-end',true)}${button('Keep exploring','close')}</div>`);
  else if(action==='confirm-end') {document.querySelector('#dialog').close();go('home');}
  else if(action==='close') document.querySelector('#dialog').close();
  else if(action==='overlay') go('overlay');
  else if(action==='capture') showDialog(`<h2>Capture screen</h2><p>The native app will let you choose a display and request screen-recording permission. This preview does not capture your screen.</p><div class="dialog-actions">${button('View example session','capture-example',true)}</div>`);
  else if(action==='capture-example') {document.querySelector('#dialog').close();go('session');}
  else if(action==='connect') showDialog('<h2>Connect your AI</h2><p>The native flow will validate your key and retrieve available models. Key entry and network requests are disabled in this preview.</p>');
  else if(action==='tool') toast('Tool configuration is part of the planned native implementation.');
  else if(action==='followup') {document.querySelector('#chat-input').value=target.textContent;document.querySelector('#chat-input').focus();}
  else if(action?.startsWith('select-')) {currentAssistant=Number(action.split('-')[1]);render();}
  else if(action==='create'||action?.startsWith('edit-')) {
    const index=action==='create'?-1:Number(action.split('-')[1]);
    const a=assistants[index]||{name:'',description:''};
    showDialog(`<h2>${index<0?'Create':'Edit'} assistant</h2><form id="assistant-form" data-index="${index}"><label class="field">Name<input name="name" required maxlength="60" value="${escapeHtml(a.name)}" placeholder="Your assistant name"></label><label class="field">Instructions<textarea name="description" required maxlength="2000" rows="4" placeholder="What should this assistant help you with?">${escapeHtml(a.description)}</textarea></label><button class="button primary">Save preview assistant</button><p class="section-note">Temporary preview only. Changes reset on reload.</p></form>`);
  } else if(action==='export') {
    const blob=new Blob(['# Example session\n\nFictional preview content; no actual recording.\n\nTHEY: What would make a personal assistant useful during a study session?\n\nME: I want to stay focused on the conversation.\n'],{type:'text/markdown'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='example-session.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Exported the labeled example transcript.');
  }
});
document.addEventListener('submit', event => {
  if(event.target.id==='chat-form') {event.preventDefault();if(document.querySelector('#chat-input').value.trim()) toast('Preview only. Connect a provider in the native app to receive a real answer.');}
  if(event.target.id==='assistant-form') {
    event.preventDefault();
    const data=new FormData(event.target);
    const a={name:String(data.get('name')).trim(),description:String(data.get('description')).trim(),icon:'✳'};
    if(!a.name||!a.description) return;
    const index=Number(event.target.dataset.index);
    if(index<0) assistants.push(a);else assistants[index]=a;
    document.querySelector('#dialog').close();render();
  }
});
document.addEventListener('input', event => {
  if(event.target.id==='history-search') {searchQuery=event.target.value;document.querySelector('#history-results').innerHTML=sessionList(searchQuery);}
});
document.querySelector('#search').addEventListener('keydown', event => {
  if(event.key==='Enter') {searchQuery=event.target.value;go('sessions');}
});
window.addEventListener('hashchange',render);
render();
