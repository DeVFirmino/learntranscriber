// User headers override defaults case-insensitively, including Authorization; transport and body framing headers stay app-owned.
const RESERVED = new Set([
  'host',
  'content-length',
  'content-type',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'expect',
]);
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;
const LIMIT = 20;

function normalizeHeaders(input, previous = []) {
  if (!Array.isArray(input) || input.length > LIMIT) throw new Error(`Add at most ${LIMIT} custom headers.`);
  const stored = new Map(previous.map((item) => [item.key.toLowerCase(), item.value])),
    seen = new Set(),
    result = [];
  for (const item of input) {
    const key = typeof item?.key === 'string' ? item.key.trim() : '';
    if (!TOKEN.test(key)) throw new Error('Header names may use letters, digits and - _ . only.');
    const lower = key.toLowerCase();
    if (RESERVED.has(lower)) throw new Error(`${key} is managed by LearnTranscriber.`);
    if (seen.has(lower)) throw new Error(`${key} appears more than once.`);
    seen.add(lower);
    const value = item.value === null ? stored.get(lower) : item.value;
    if (typeof value !== 'string') throw new Error(`Enter a value for ${key}.`);
    if (value.length > 4096 || /[\r\n\0]/.test(value))
      throw new Error(`The value for ${key} must be one line of at most 4,096 characters.`);
    result.push({ key, value: value.trim() });
  }
  return result;
}

function mergeHeaders(defaults, custom) {
  const merged = { ...defaults };
  for (const { key, value } of custom) {
    for (const existing of Object.keys(merged))
      if (existing.toLowerCase() === key.toLowerCase()) delete merged[existing];
    merged[key] = value;
  }
  return merged;
}

module.exports = { normalizeHeaders, mergeHeaders, RESERVED };
