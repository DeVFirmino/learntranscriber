const { validateEndpoint } = require('../../domain/settings/endpoint.cjs');
const { completionOptions, promptBudget } = require('../../domain/providers/context-budget.cjs');

const REPLY_LIMIT = 8 * 1024 * 1024;

// Reads a JSON reply from the owned local server, refusing failed or oversized responses.
async function jsonReply(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      'The local server cannot measure context. Use a llama-server runtime with /apply-template and /tokenize support.',
    );
  }
  if (Number(response.headers.get('content-length')) > REPLY_LIMIT) {
    await response.body?.cancel();
    throw new Error('Local context measurement is too large.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Local context measurement returned no data.');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > REPLY_LIMIT) throw new Error('Local context measurement is too large.');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Counts the prompt's tokens with the managed llama-server's own template and tokenizer.
async function measureContext(fetchImpl, settings, body, signal) {
  if (!settings.managedLocal) return null;
  signal?.throwIfAborted();
  const base = new URL(validateEndpoint(settings.customBaseUrl));
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))
    throw new Error('Managed context measurement requires the owned loopback server.');
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000);
  // Neither endpoint is public once llama-server has an API key, so the request carries it when the lease has one.
  const headers = {
    'Content-Type': 'application/json',
    ...(settings.localApiKey ? { Authorization: `Bearer ${settings.localApiKey}` } : {}),
  };
  const post = async (endpoint, value) =>
    jsonReply(
      await fetchImpl(new URL(endpoint, base.origin), {
        method: 'POST',
        headers,
        body: JSON.stringify(value),
        signal: requestSignal,
        redirect: 'error',
      }),
    );
  const formatted = await post('/apply-template', {
    messages: body.messages,
    ...(body.tools ? { tools: body.tools, tool_choice: body.tool_choice } : {}),
    ...completionOptions(settings),
  });
  if (typeof formatted.prompt !== 'string' || !formatted.prompt)
    throw new Error('Local server returned an invalid chat template.');
  if (body.tools?.some((tool) => !formatted.prompt.includes(tool.function.name)))
    throw new Error(
      'The local server template did not include the offered tools. Context could not be measured safely.',
    );
  const tokenized = await post('/tokenize', {
    content: formatted.prompt,
    add_special: false,
    parse_special: true,
    with_pieces: false,
  });
  if (
    !Array.isArray(tokenized.tokens) ||
    !tokenized.tokens.length ||
    tokenized.tokens.some((token) => !Number.isInteger(token) || token < 0)
  )
    throw new Error('Local server returned an invalid token count.');
  signal?.throwIfAborted();
  return promptBudget(settings, tokenized.tokens.length);
}

module.exports = { measureContext, jsonReply };
