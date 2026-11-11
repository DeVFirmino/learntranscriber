const { completionOptions } = require('../../domain/providers/context-budget.cjs');
const { compatibleOptions } = require('../../domain/providers/generation-presets.cjs');

// The OpenAI-compatible chat completions protocol: OpenAI, OpenRouter, custom endpoints and managed local models.
function asImages(image) {
  return Array.isArray(image) ? image : image ? [image] : [];
}
// Images go before the question, and several are labelled in order. Local vision models given the text first
// described only one image of a pair; with this layout SmolVLM2 2.2B named both in order.
function imageParts(urls) {
  const image = (url) => ({ type: 'image_url', image_url: { url } });
  return urls.length === 1
    ? [image(urls[0])]
    : urls.flatMap((url, index) => [{ type: 'text', text: `Image ${index + 1}:` }, image(url)]);
}
function chatBody(settings, messages, image, tools = []) {
  const copy = structuredClone(messages),
    images = asImages(image);
  if (images.length && !copy.at(-1)._images) copy.at(-1)._images = images;
  for (const message of copy) {
    const attached = message._images || asImages(message._image);
    if (attached.length) message.content = [...imageParts(attached), { type: 'text', text: message.content }];
    delete message._image;
    delete message._images;
  }
  if (settings.managedLocal && copy.some((message) => Array.isArray(message.content)) && !settings.visionCapable)
    throw new Error(
      'Managed local screenshots require a vision model and projector. Choose a vision-capable model in Local models.',
    );
  return {
    model: settings.model,
    messages: copy,
    stream: true,
    ...completionOptions(settings),
    ...compatibleOptions(settings),
    ...(tools.length
      ? {
          tools: tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters, strict: false },
          })),
          tool_choice: 'auto',
        }
      : {}),
  };
}

const compatible = {
  requiresCallId: true,
  async request({ settings, messages, image, tools, key, base, customHeaders }) {
    let headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    headers = await customHeaders(headers);
    return { url: `${base}/chat/completions`, headers, body: chatBody(settings, messages, image, tools) };
  },
  reader() {
    const toolCalls = new Map();
    return {
      toolCalls,
      delta: (event) => event.choices?.[0]?.delta?.content,
      observe(event) {
        for (const call of event.choices?.[0]?.delta?.tool_calls || []) {
          if (!Number.isInteger(call.index) || call.index < 0 || call.index > 7)
            throw new Error('Invalid tool call index.');
          const current = toolCalls.get(call.index) || { id: '', name: '', raw: '' };
          current.id += call.id || '';
          current.name += call.function?.name || '';
          current.raw += call.function?.arguments || '';
          if (current.raw.length > 32000 || current.name.length > 100 || current.id.length > 200)
            throw new Error('Tool request exceeds its size limit.');
          toolCalls.set(call.index, current);
        }
      },
      finish() {},
      message: (answer, calls) => ({
        role: 'assistant',
        content: answer || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: c.raw },
              })),
            }
          : {}),
      }),
    };
  },
  toolResult: (call, result) => ({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) }),
};
module.exports = { compatible, chatBody, asImages };
