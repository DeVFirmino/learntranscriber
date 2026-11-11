const DEFINITIONS = [
  ['hide', 'Hide / restore all windows', 'CommandOrControl+B', true, 'toggleVisibility'],
  ['overlay', 'Toggle floating assistant', 'CommandOrControl+M', true, 'toggleActionBar'],
  ['clickThrough', 'Toggle click-through', 'CommandOrControl+Shift+I', true, null],
  ['selection', 'Read selected text', 'CommandOrControl+Shift+K', true, null],
  ['ask', 'Ask / submit question', 'CommandOrControl+Return', true, 'execute'],
  ['capture', 'Capture screen', 'CommandOrControl+E', true, 'screenshot'],
  ['record', 'Start listening / analyze conversation', 'CommandOrControl+D', true, 'whisper'],
  ['mic', 'Mute / unmute microphone', 'CommandOrControl+Shift+D', true, 'toggleMicCapture'],
  ['previousInsight', 'Previous Notch insight', 'CommandOrControl+Left', true, 'notchHistoryPrev'],
  ['nextInsight', 'Next Notch insight', 'CommandOrControl+Right', true, 'notchHistoryNext'],
  ['previousResponse', 'Previous response', 'CommandOrControl+Alt+Up', true, 'anchorPrev'],
  ['nextResponse', 'Next response', 'CommandOrControl+Alt+Down', true, 'anchorNext'],
  ['scrollUp', 'Scroll up', 'CommandOrControl+Up', true, 'scrollUp'],
  ['scrollDown', 'Scroll down', 'CommandOrControl+Down', true, 'scrollDown'],
  ['onTop', 'Toggle always on top', 'CommandOrControl+Shift+A', true, 'toggleAlwaysOnTop'],
  ['opacityUp', 'Increase opacity', 'CommandOrControl+Shift+Plus', true, 'increaseAppOpacity'],
  ['opacityDown', 'Decrease opacity', 'CommandOrControl+Shift+-', true, 'decreaseAppOpacity'],
  ['moveLeft', 'Slide session panel left', 'CommandOrControl+Shift+Left', false, 'moveWindowLeft'],
  ['moveRight', 'Slide session panel right', 'CommandOrControl+Shift+Right', false, 'moveWindowRight'],
  ['moveUp', 'Slide session panel up', 'CommandOrControl+Shift+Up', true, 'moveWindowUp'],
  ['moveDown', 'Slide session panel down', 'CommandOrControl+Shift+Down', true, 'moveWindowDown'],
  ['notch', 'Toggle Notch', 'CommandOrControl+Shift+N', false, null],
].map(([id, label, accelerator, enabled, reference]) => ({ id, label, accelerator, enabled, reference }));

const MODIFIERS = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Shift', 'Super'];
const KEY =
  /^([A-Z0-9]|F([1-9]|1\d|2[0-4])|Space|Return|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|Up|Down|Left|Right|Plus|PageUp|PageDown|numadd|numsub|=|-)$/;
// Electron rejects "Minus" ("conversion failure"); earlier versions saved it for the minus key.
const normalize = (accelerator) => accelerator.replace(/\+Minus$/, '+-');

function comparisonKey(accelerator, platform) {
  const parts = accelerator.split('+');
  const mods = parts
    .slice(0, -1)
    .map((m) => (m === 'CommandOrControl' ? (platform === 'darwin' ? 'Command' : 'Control') : m));
  if (new Set(mods).size !== mods.length) throw new Error('Shortcut modifiers cannot repeat.');
  const key = parts.at(-1) === 'Enter' ? 'Return' : parts.at(-1);
  return mods.sort().join('+') + '+' + key;
}

function validAccelerator(accelerator) {
  const parts = accelerator.split('+');
  if (
    parts.length < 2 ||
    parts.length > 5 ||
    !parts.slice(0, -1).some((m) => ['CommandOrControl', 'Command', 'Control', 'Alt', 'Super'].includes(m)) ||
    parts.slice(0, -1).some((m) => !MODIFIERS.includes(m)) ||
    !KEY.test(parts.at(-1))
  )
    throw new Error('Use an Electron shortcut such as CommandOrControl+Shift+K.');
}

// Saved overrides keep their keys. A default that collides with an enabled override yields to it and is reported
// as blocked, so a changed default never
// invalidates a saved configuration. Two enabled overrides can never share a key. The platform decides whether
// CommandOrControl collides with Command (macOS) or Control.
function shortcutConfig(raw, platform) {
  let overrides;
  try {
    overrides = JSON.parse(raw);
  } catch {
    throw new Error('Invalid shortcut configuration.');
  }
  if (
    !overrides ||
    Array.isArray(overrides) ||
    typeof overrides !== 'object' ||
    Object.keys(overrides).some((id) => !DEFINITIONS.some((d) => d.id === id))
  )
    throw new Error('Unknown shortcut action.');
  const items = DEFINITIONS.map((d) => {
    const o = overrides[d.id];
    if (o !== undefined && (!o || typeof o !== 'object' || Array.isArray(o)))
      throw new Error('Invalid shortcut override.');
    const item = { ...d, ...o };
    if (
      Object.keys(o || {}).some((k) => !['accelerator', 'enabled'].includes(k)) ||
      typeof item.enabled !== 'boolean' ||
      typeof item.accelerator !== 'string'
    )
      throw new Error('Invalid shortcut fields.');
    item.accelerator = normalize(item.accelerator);
    validAccelerator(item.accelerator);
    return { item, custom: o !== undefined, key: comparisonKey(item.accelerator, platform) };
  });
  const claimed = new Map();
  for (const { item, custom, key } of items) {
    if (!custom || !item.enabled) continue;
    if (claimed.has(key)) throw new Error('Enabled shortcuts cannot be duplicated.');
    claimed.set(key, item.id);
  }
  return items.map(({ item, custom, key }) => {
    const owner = claimed.get(key);
    return !custom && item.enabled && owner ? { ...item, enabled: false, blockedBy: owner } : item;
  });
}

module.exports = { DEFINITIONS, shortcutConfig };
