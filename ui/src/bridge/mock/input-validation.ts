// Shared input checks the mock API methods reuse, so every feature rejects bad input the same way.
export function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Enter valid text within the length limit.')
  return value.trim()
}

// Keeps provider endpoints to a shape the native app would accept: no credentials, HTTPS unless local.
export function validateEndpoint(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid provider endpoint.')
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Endpoints must not contain credentials, queries, or fragments.')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new Error('Use HTTPS, or HTTP for a local server.')
  return url.toString().replace(/\/$/, '')
}
