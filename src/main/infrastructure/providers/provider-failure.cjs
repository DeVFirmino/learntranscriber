const NAMES = { openai: 'OpenAI', gemini: 'Gemini', openrouter: 'OpenRouter', chatgpt: 'ChatGPT' };

// A rejected provider request as the user can act on it: which provider answered, and what to change for the status
// it gave. The response body never enters the message, so a provider's diagnostics or echoed key cannot leak.
function providerFailure(status, provider) {
  const name = NAMES[provider] || (provider === 'custom' ? 'The custom endpoint' : 'The provider');
  if (status === 401 || status === 403)
    return `${name} rejected the credentials (HTTP ${status}). Update the API key or sign in again in AI sources.`;
  if (status === 404)
    return `${name} could not find the model or endpoint (HTTP 404). Choose another model in Settings › Models.`;
  if (status === 429)
    return `${name} is limiting requests or out of quota (HTTP 429). Try again later or check your plan.`;
  return `${name} returned HTTP ${status}. Check the model and endpoint in AI sources.`;
}

module.exports = { providerFailure };
