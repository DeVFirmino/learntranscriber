import type { UpdateStatus } from '../types/updates'

// The preview has no real GitHub to check, so it starts with no update, the common case, unless the page is opened
// with ?update=available to show and exercise the banner, the way ?window picks a window role. The node:test
// sandboxes that load this module give it no window.location at all; that missing-global case also falls back here.
export function previewUpdateStatus(): UpdateStatus {
  try {
    if (new URLSearchParams(window.location.search).get('update') === 'available')
      return {
        available: true,
        version: '1.5.0',
        tagName: 'v1.5.0',
        url: 'https://github.com/DeVFirmino/learntranscriber/releases/tag/v1.5.0',
      }
  } catch {
    /* No query string in this environment; fall through to no update. */
  }
  return { available: false }
}
