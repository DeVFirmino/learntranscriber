const TARGETS = Object.freeze([
  { id: 'ollama', name: 'Ollama', base: 'http://127.0.0.1:11434', path: '/api/tags' },
  { id: 'lmstudio', name: 'LM Studio', base: 'http://127.0.0.1:1234', path: '/v1/models' },
]);
async function discoverLocalServers(fetchImpl = fetch) {
  return Promise.all(
    TARGETS.map(async (target) => {
      try {
        const response = await fetchImpl(target.base + target.path, {
          signal: AbortSignal.timeout(1800),
          redirect: 'error',
        });
        if (!response.ok) throw Error();
        const reader = response.body.getReader();
        const parts = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1000000) {
            await reader.cancel();
            throw Error();
          }
          parts.push(value);
        }
        const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
        const models = target.id === 'ollama' ? data.models?.map((m) => m.name) : data.data?.map((m) => m.id);
        if (!Array.isArray(models)) throw Error();
        return {
          id: target.id,
          name: target.name,
          endpoint: target.base + '/v1',
          available: true,
          models: models.filter((m) => typeof m === 'string' && m.length < 200).slice(0, 100),
        };
      } catch {
        return { id: target.id, name: target.name, endpoint: target.base + '/v1', available: false, models: [] };
      }
    }),
  );
}
module.exports = { discoverLocalServers, TARGETS };
