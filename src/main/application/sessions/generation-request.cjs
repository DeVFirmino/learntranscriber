// Completion is based on the owned signal, since providers may wrap an abort in a generic error.
function createGenerationRequest({ requests, finished }) {
  return async function run(metadata, work, onCompletion) {
    const { id, sessionId, mode, sequence } = metadata;
    let completion = { outcome: 'success' };
    try {
      return await requests.run(metadata, async (signal) => {
        try {
          const result = await work(signal);
          signal.throwIfAborted();
          return result;
        } catch (error) {
          if (signal.aborted && signal.reason?.name !== 'TimeoutError') completion = { outcome: 'cancelled' };
          else
            completion = {
              outcome: 'error',
              errorCode: signal.reason?.name === 'TimeoutError' ? 'timeout' : 'generationFailed',
            };
          throw error;
        }
      });
    } catch (error) {
      if (completion.outcome === 'success') completion = { outcome: 'error', errorCode: 'generationFailed' };
      throw error;
    } finally {
      onCompletion(completion);
      finished({ requestId: id, sessionId, mode, sequence, ...completion });
    }
  };
}
module.exports = { createGenerationRequest };
