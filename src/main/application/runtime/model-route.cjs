// A local provider runs through a leased local server for the length of one call; others pass through unchanged.
// `vision` also reports whether the leased model accepts images.
function createModelRoute({ acquireLocal }) {
  return {
    async run(settings, work, { vision = false, signal } = {}) {
      signal?.throwIfAborted();
      const lease = settings.provider === 'local' ? await acquireLocal(settings, signal) : null;
      try {
        signal?.throwIfAborted();
        return await work(
          lease
            ? {
                ...settings,
                provider: 'custom',
                managedLocal: true,
                ...(vision ? { visionCapable: lease.vision } : {}),
                contextSize: lease.contextSize,
                customBaseUrl: lease.base + '/v1',
                model: lease.model,
                localApiKey: lease.apiKey || null,
              }
            : settings,
        );
      } finally {
        lease?.release();
      }
    },
  };
}
module.exports = { createModelRoute };
