// One line of the error log: time, level and the message, with anything shaped like a credential replaced and the
// length capped, so a provider error that echoes a key or a long transcript never lands whole on disk.
const MAX_LINE = 4000;
const SECRETS = [
  /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /(?<=[?&](?:key|api_key|access_token|refresh_token|token)=)[^&\s]+/gi,
];

function describe(part) {
  if (part instanceof Error) return part.stack || part.message;
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

function redact(text) {
  return SECRETS.reduce((value, pattern) => value.replace(pattern, '[redacted]'), text);
}

function logLine({ time, level, parts }) {
  const message = redact(parts.map(describe).join(' ')).replace(/\r?\n/g, '\n    ');
  const capped = message.length > MAX_LINE ? `${message.slice(0, MAX_LINE)}… [truncated]` : message;
  return `${time.toISOString()} ${level.toUpperCase()} ${capped}\n`;
}
module.exports = { logLine };
