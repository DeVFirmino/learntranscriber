// What the preview does in the browser itself: opening the floating assistant as the overlay window, and drawing a
// sample display capture.
export function setOverlay(open: boolean) {
  const url = new URL(window.location.href)
  if (open) url.searchParams.set('window', 'overlay')
  else url.searchParams.delete('window')
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// A drawn stand-in for a display capture, checked like a real PNG data URL.
export async function previewPng() {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare a preview image.')
  context.fillStyle = '#1b2430'
  context.fillRect(0, 0, 320, 180)
  context.fillStyle = '#d6e6ff'
  context.font = '16px sans-serif'
  context.fillText('Preview display capture', 24, 96)
  const image = canvas.toDataURL('image/png')
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Invalid screen image.')
  return image
}
