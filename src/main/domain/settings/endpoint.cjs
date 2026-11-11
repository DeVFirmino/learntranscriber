// A provider endpoint as saved and requested: HTTPS, or HTTP only for a server on this machine, without
// credentials, queries or fragments, and without a trailing slash.
function validateEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid provider endpoint.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Endpoints must not contain credentials, queries, or fragments.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new Error('Use HTTPS, or HTTP for a local server.');
  return url.toString().replace(/\/$/, '');
}

module.exports = { validateEndpoint };
