const { asImages, compatible } = require('./compatible.cjs');
const { responseOptions } = require('../../domain/providers/generation-presets.cjs');

// The ChatGPT Responses protocol. A stream only counts once it reports response.completed.
const chatgpt = {
  requiresCallId: true,
  async request({ settings, messages, tools, key, base }) {
    const input = [];
    for (const message of messages.filter((m) => m.role !== 'system')) {
      if (message.role === 'tool') {
        input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: message.content });
        continue;
      }
      if (message.content) {
        const attached = message._images || asImages(message._image);
        input.push({
          role: message.role,
          content: attached.length
            ? [
                { type: 'input_text', text: message.content },
                ...attached.map((image_url) => ({ type: 'input_image', image_url })),
              ]
            : message.content,
        });
      }
      for (const call of message.tool_calls || [])
        input.push({
          type: 'function_call',
          call_id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        });
    }
    return {
      url: base + '/responses',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: {
        model: settings.model,
        instructions: messages
          .filter((m) => m.role === 'system')
          .map((m) => m.content)
          .join('\n'),
        input,
        store: false,
        stream: true,
        ...responseOptions(settings),
        ...(tools.length
          ? {
              tools: tools.map((t) => ({
                type: 'function',
                name: t.name,
                description: t.description,
                parameters: t.parameters,
                strict: false,
              })),
            }
          : {}),
      },
    };
  },
  reader() {
    const toolCalls = new Map();
    let completed = false;
    return {
      toolCalls,
      delta: (event) => (event.type === 'response.output_text.delta' ? event.delta : undefined),
      observe(event) {
        if (event.type === 'response.completed') completed = true;
        if (['response.failed', 'response.incomplete', 'error'].includes(event.type))
          throw new Error('ChatGPT did not complete this response. Check plan access or retry.');
        if (event.type === 'response.output_item.added' && event.item?.type === 'function_call')
          toolCalls.set(event.item.id, {
            id: event.item.call_id,
            name: event.item.name,
            raw: event.item.arguments || '',
          });
        if (event.type === 'response.function_call_arguments.delta') {
          const call = toolCalls.get(event.item_id);
          if (call) call.raw += event.delta || '';
        }
        if (event.type === 'response.output_item.done' && event.item?.type === 'function_call')
          toolCalls.set(event.item.id, {
            id: event.item.call_id,
            name: event.item.name,
            raw: event.item.arguments || '',
          });
        if (toolCalls.size > 8 || [...toolCalls.values()].some((c) => c.raw.length > 32000))
          throw new Error('ChatGPT tool request exceeds the size limit.');
      },
      finish() {
        if (!completed) throw new Error('ChatGPT stream ended before response.completed. Retry the request.');
      },
      message: (answer, calls) => compatible.reader().message(answer, calls),
    };
  },
  toolResult: compatible.toolResult,
};
module.exports = { chatgpt };
