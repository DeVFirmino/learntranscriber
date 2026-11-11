const { asImages } = require('./compatible.cjs');
const { geminiOptions } = require('../../domain/providers/generation-presets.cjs');

// The Gemini streamGenerateContent protocol. Thought parts never reach the answer, and the model's parts are
// replayed verbatim so tool calls keep their metadata.
const gemini = {
  requiresCallId: false,
  async request({ settings, messages, tools, key, base }) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: m._parts || [
          { text: m.content },
          ...(m._images || asImages(m._image)).map((value) => ({
            inlineData: { mimeType: value.slice('data:'.length, value.indexOf(';')), data: value.split(',')[1] },
          })),
        ],
      }));
    return {
      url: `${base}/models/${encodeURIComponent(settings.model)}:streamGenerateContent?alt=sse`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(settings.generationConfig ? { generationConfig: geminiOptions(settings) } : {}),
        ...(tools.length
          ? {
              tools: [
                {
                  functionDeclarations: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.parameters,
                  })),
                },
              ],
            }
          : {}),
      },
    };
  },
  reader() {
    const toolCalls = new Map(),
      parts = [];
    return {
      toolCalls,
      delta: (event) =>
        event.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text || '')
          .join(''),
      observe(event) {
        for (const part of event.candidates?.[0]?.content?.parts || []) {
          parts.push(part);
          if (part.functionCall) {
            if (toolCalls.size >= 8) throw new Error('Too many tool calls in one response.');
            const call = part.functionCall;
            toolCalls.set(toolCalls.size, { name: call.name, id: call.id, arguments: call.args || {} });
          }
        }
      },
      finish() {},
      message: () => ({ role: 'assistant', _parts: parts }),
    };
  },
  toolResult: (call, result) => ({
    role: 'user',
    _parts: [
      { functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { output: result } } },
    ],
  }),
};
module.exports = { gemini };
