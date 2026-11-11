// The fixed API bases of the hosted providers; custom endpoints come from settings.
const BASES = Object.freeze({
  chatgpt: 'https://api.openai.com/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
});
module.exports = { BASES };
