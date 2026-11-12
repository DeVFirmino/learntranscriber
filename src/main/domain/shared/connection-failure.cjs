// Node's fetch reports a request that never reached its server, or a connection that dropped mid-answer, as an error
// whose cause, or one of the cause's grouped errors, carries one of these codes. A redirect refusal or an abort is not
// a connection failure and keeps its own message.
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_CLOSED',
]);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

const UNREACHABLE = 'Could not reach the AI service. Check your internet connection and try again.';
const LOCAL_SILENT =
  'The local server on this Mac is not answering. Start it again or check its address in AI sources.';
const DROPPED = 'The connection dropped during the answer. Check your internet connection and try again.';

function codesOf(error) {
  const cause = error?.cause;
  return [error?.code, cause?.code, ...(Array.isArray(cause?.errors) ? cause.errors.map((inner) => inner?.code) : [])];
}

function isConnectionFailure(error) {
  return codesOf(error).some((code) => NETWORK_CODES.has(code));
}

// A loopback address is a server on this Mac, so "check your internet" would send the user the wrong way.
function unreachableMessage(url) {
  let host = '';
  try {
    host = new URL(String(url)).hostname;
  } catch {
    host = '';
  }
  return LOOPBACK.has(host) ? LOCAL_SILENT : UNREACHABLE;
}

module.exports = { isConnectionFailure, unreachableMessage, DROPPED_MESSAGE: DROPPED };
