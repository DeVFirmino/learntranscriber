// The tool calls a model may make: offered tools only, with object arguments under 32 KB, identified when the
// protocol needs a call id.
function validatedToolCalls(calls, tools, requiresCallId) {
  return calls.map((call) => {
    let args = call.arguments;
    try {
      if (call.raw !== undefined) args = JSON.parse(call.raw || '{}');
    } catch {
      throw new Error('The model returned invalid tool arguments.');
    }
    if (!args || typeof args !== 'object' || Array.isArray(args) || JSON.stringify(args).length > 32000)
      throw new Error('Invalid model tool arguments.');
    if (typeof call.name !== 'string' || !tools.some((tool) => tool.name === call.name))
      throw new Error('The model requested a tool that was not offered.');
    if (requiresCallId && !call.id) throw new Error('Tool request has no identity.');
    return { ...call, arguments: args };
  });
}

// Model ids from a provider's model list: ChatGPT's listed slugs, Gemini's names, or sorted OpenAI-style ids.
function modelIds(provider, json) {
  if (provider === 'chatgpt') return (json.models || []).filter((m) => m.visibility === 'list').map((m) => m.slug);
  if (provider === 'gemini') return (json.models || []).map((m) => m.name.replace(/^models\//, ''));
  return (json.data || [])
    .map((m) => m.id)
    .filter((id) => typeof id === 'string')
    .sort();
}

module.exports = { validatedToolCalls, modelIds };
