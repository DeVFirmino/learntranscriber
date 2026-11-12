const { isConnectionFailure, unreachableMessage } = require('../../domain/shared/connection-failure.cjs');

// Provider requests through fetch, with a request that never reached its server told apart from every other failure:
// Node reports it only as "fetch failed", which says nothing the user can act on.
function reachingFetch(fetch) {
  return async (url, init) => {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (isConnectionFailure(error)) throw new Error(unreachableMessage(url), { cause: error });
      throw error;
    }
  };
}

module.exports = { reachingFetch };
