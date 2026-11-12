const { validateEndpoint } = require('../../domain/settings/endpoint.cjs');
const { measureContext } = require('../local/context-measurement.cjs');
const { mergeHeaders } = require('../../domain/providers/custom-headers.cjs');
const { sse, requireOk } = require('./sse.cjs');
const { compatible, chatBody, asImages } = require('./compatible.cjs');
const { chatgpt } = require('./chatgpt.cjs');
const { gemini } = require('./gemini.cjs');
const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const { BASES } = require('./endpoints.cjs');
const { providerTranscript } = require('./audio-transcription.cjs');
const { validatedToolCalls, modelIds } = require('../../domain/providers/model-tools.cjs');

// OpenAI, OpenRouter and custom endpoints share the compatible protocol.
const PROTOCOLS = { chatgpt, gemini };
const protocolFor = (provider) => PROTOCOLS[provider] || compatible;

// Every model request: streamed turns with a bounded tool loop, context measurement for the managed local server,
// model lists and recorded-audio transcription. `fetch` stays a property so the requests can be observed.
class Providers {
  constructor(getKey, fetchImpl = fetch, getHeaders = async () => []) {
    this.getKey = getKey;
    this.fetch = fetchImpl;
    this.getHeaders = getHeaders;
  }
  async customHeaders(settings, defaults) {
    return settings.provider === 'custom' && !settings.managedLocal
      ? mergeHeaders(defaults, await this.getHeaders())
      : defaults;
  }
  /** Fails the way a turn would when the route has no model or key, before anything is stored. */
  async ready(settings) {
    if (!String(settings.model || '').trim()) throw new Error('Choose an assistant model in AI sources.');
    if (!settings.managedLocal && settings.provider !== 'custom' && !(await this.getKey(settings.provider)))
      throw new Error('Add a provider key in AI sources.');
  }
  checkContext(settings, messages, signal, image, tools = []) {
    settings = forFeature(settings, settings.generationFeature);
    return settings.managedLocal
      ? measureContext(this.fetch, settings, chatBody(settings, messages, image, tools), signal)
      : Promise.resolve(null);
  }
  async stream(settings, messages, onDelta, signal, image, options = {}) {
    const history = structuredClone(messages),
      images = asImages(image);
    if (images.length) history.at(-1)._images = images;
    let answer = '',
      count = 0;
    for (let round = 0; round < 4; round++) {
      signal?.throwIfAborted();
      const turn = await this.turn(
        round > 0 ? forFeature(settings, 'mcp') : settings,
        history,
        onDelta,
        signal,
        round === 0 ? image : undefined,
        options.tools || [],
      );
      answer += turn.answer;
      if (!turn.calls.length) {
        if (!answer.trim()) throw new Error('The provider returned no text. Choose a text-capable model.');
        return answer;
      }
      if (!options.handleTool) throw new Error('The model requested a tool but tools are not enabled.');
      history.push(turn.message);
      for (const call of turn.calls) {
        signal?.throwIfAborted();
        if (++count > 8) throw new Error('Tool request limit reached. Ask a narrower question.');
        const result = await options.handleTool(call);
        history.push(protocolFor(settings.provider).toolResult(call, result));
      }
    }
    throw new Error('The assistant reached the four-round tool limit. Ask a narrower question.');
  }
  async turn(settings, messages, onDelta, signal, image, tools = []) {
    settings = forFeature(settings, settings.generationFeature);
    if (!settings.model.trim()) throw new Error('Choose an assistant model in AI sources.');
    const provider = settings.provider,
      // A managed local request never touches a saved provider credential; it carries its own per-launch key.
      key = settings.managedLocal ? settings.localApiKey || '' : await this.getKey(provider);
    if (provider !== 'custom' && !key) throw new Error('Add a provider key in AI sources.');
    const base = provider === 'custom' ? validateEndpoint(settings.customBaseUrl) : BASES[provider];
    const protocol = protocolFor(provider);
    const { url, headers, body } = await protocol.request({
      settings,
      messages,
      image,
      tools,
      key,
      base,
      customHeaders: (defaults) => this.customHeaders(settings, defaults),
    });
    if (settings.managedLocal) await measureContext(this.fetch, settings, body, signal);
    const response = await requireOk(
      await this.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal, redirect: 'error' }),
      provider,
    );
    let answer = '';
    const reader = protocol.reader();
    for await (const event of sse(response)) {
      if (event.error) throw new Error('The provider rejected the generation request. Check the model configuration.');
      const delta = reader.delta(event);
      if (typeof delta === 'string') {
        answer += delta;
        if (answer.length > 100000) throw new Error('Provider response exceeds the 100,000 character limit.');
        onDelta(delta);
      }
      reader.observe(event);
    }
    reader.finish();
    const calls = validatedToolCalls([...reader.toolCalls.values()], tools, protocol.requiresCallId);
    return { answer, calls, message: reader.message(answer, calls) };
  }
  async models(settings) {
    const key = settings.managedLocal ? settings.localApiKey || '' : await this.getKey(settings.provider);
    if (settings.provider !== 'custom' && !key) throw new Error('Add a provider key first.');
    const base = settings.provider === 'custom' ? validateEndpoint(settings.customBaseUrl) : BASES[settings.provider];
    const auth = settings.provider === 'gemini' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` };
    const headers = await this.customHeaders(settings, key ? auth : {});
    const response = await requireOk(
      await this.fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' }),
      settings.provider,
    );
    return modelIds(settings.provider, await response.json());
  }
  async transcribe(settings, bytes, mime, signal) {
    const provider = settings.transcriptionProvider;
    const key = settings.managedLocal ? '' : await this.getKey(provider);
    if (provider !== 'custom' && !key)
      throw new Error('Add an OpenAI key or configure a local transcription endpoint.');
    return providerTranscript({ fetch: this.fetch, key, settings, bytes, mime, signal });
  }
}
module.exports = { Providers };
