const path = require('node:path');
const { BOUNDS: LOCAL_BOUNDS } = require('../providers/local-launch.cjs');
const { DEFAULTS } = require('./defaults.cjs');
const { validateEndpoint } = require('./endpoint.cjs');
const { shortcutConfig } = require('./shortcuts.cjs');

// The longest saved texts: the shortcut table and the user-global prompts are documents; other texts stay short.
const TEXT_LIMITS = Object.freeze({
  shortcuts: 10000,
  globalFollowUpPrompt: 20000,
  globalEmailPrompt: 20000,
});
const SHORT_TEXT = 2000;

const PROVIDERS = ['openai', 'gemini', 'openrouter', 'custom', 'local', 'chatgpt'];

// Settings limited to a list of choices, with the message for any other value.
const CHOICES = Object.freeze({
  onboardingAudioSource: [['', 'microphone', 'computer'], 'Choose microphone or computer audio.'],
  systemAudioSource: [
    ['native', 'process-tap', 'electron', 'input-device'],
    'Choose a supported incoming audio source.',
  ],
  provider: [PROVIDERS, 'Unsupported provider.'],
  translationProvider: [['', ...PROVIDERS], 'Unsupported translation provider.'],
  transcriptionProvider: [['apple', 'openai', 'gemini', 'custom', 'local'], 'Unsupported transcription provider.'],
  insightMode: [
    ['only_questions', 'moderate', 'proactive', 'full_power', 'meeting_notes'],
    'Choose a supported live insight mode.',
  ],
  uiLanguage: [['', 'en', 'es', 'pt-BR'], 'Choose a supported interface language.'],
  surfaceTheme: [['dark', 'light'], 'Choose a dark or light surface.'],
  kvCacheMode: [['off', 'moderate', 'aggressive'], 'Choose a supported KV cache mode.'],
});

const between = (min, max) => (value) => Number.isFinite(value) && value >= min && value <= max;
const wholeBetween = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;
const notchPosition = (value) => Number.isInteger(value) && Math.abs(value) <= 100000;

// Numeric settings and the values they accept, with the message for any other value.
const NUMBERS = Object.freeze({
  workspaceZoom: [
    (value) => wholeBetween(70, 150)(value) && value % 10 === 0,
    'Workspace zoom must be between 70% and 150% in 10% steps.',
  ],
  overlayOpacity: [between(0.25, 1), 'Opacity must be between 25% and 100%.'],
  // Whole 10% steps.
  unifiedModalFontScale: [
    (value) => between(0.7, 1.6)(value) && Math.abs(value * 10 - Math.round(value * 10)) <= 0.00001,
    'Floating font size must be between 70% and 160% in 10% steps.',
  ],
  // Any whole number from 1,000 up.
  compactThreshold: [
    (value) => Number.isSafeInteger(value) && value >= 1000,
    'Choose a compact threshold of at least 1,000 estimated tokens.',
  ],
  localContextSize: [wholeBetween(512, 131072), 'Choose a local context size from 512 to 131,072 tokens.'],
  ...Object.fromEntries(
    Object.entries(LOCAL_BOUNDS).map(([key, [min, max]]) => [
      key,
      [wholeBetween(min, max), `Choose ${key} from ${min} to ${max}.`],
    ]),
  ),
  notchOpacity: [between(0.45, 1), 'Notch opacity must be between 45% and 100%.'],
  notchMinimumVisibleSeconds: [wholeBetween(1, 300), 'Choose a Notch reading time from 1 to 300 seconds.'],
  notchX: [notchPosition, 'Choose a valid Notch position.'],
  notchY: [notchPosition, 'Choose a valid Notch position.'],
  notchWidth: [wholeBetween(360, 900), 'Choose a Notch width from 360 to 900 pixels.'],
  notchHeight: [wholeBetween(160, 640), 'Choose a Notch height from 160 to 640 pixels.'],
});

// Checks settings about to be saved: only known keys, each with the type of its default and a value it accepts. The
// platform decides which shortcut modifiers collide (see shortcuts.cjs).
function validateSettings(input, platform) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settings.');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`Unknown setting: ${key}`);
    if (typeof value !== typeof DEFAULTS[key]) throw new Error(`Invalid value for ${key}.`);
    if (typeof value === 'string' && value.length > (TEXT_LIMITS[key] ?? SHORT_TEXT))
      throw new Error(`Setting ${key} is too long.`);
    const choice = CHOICES[key];
    if (choice && !choice[0].includes(value)) throw new Error(choice[1]);
    const number = NUMBERS[key];
    if (number && !number[0](value)) throw new Error(number[1]);
    if (key === 'shortcuts') shortcutConfig(value, platform);
    if (key === 'sessionNotesFolder' && value !== '' && !path.isAbsolute(value))
      throw new Error('Choose a folder for session notes.');
    // An empty custom endpoint is an unconfigured provider. Requests still require a valid endpoint.
    if (key.endsWith('BaseUrl') && !(key === 'customBaseUrl' && value === '')) validateEndpoint(value);
    result[key] = value;
  }
  return result;
}

module.exports = { validateSettings };
