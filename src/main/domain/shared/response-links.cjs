function externalResponseUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid response link.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid response link.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new Error('Only HTTP or HTTPS response links are supported.');
  return url.href;
}
module.exports = { externalResponseUrl };
