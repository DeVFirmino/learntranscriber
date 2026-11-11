// What the window's address says: the page after the hash, and which window this is.
export function readRoute() {
  return window.location.hash.slice(1) || 'home'
}

export function readWindowRole() {
  return new URLSearchParams(window.location.search).get('window') || 'main'
}

// The floating overlay and the Notch are the overlay windows.
export function readOverlay() {
  return ['overlay', 'notch'].includes(readWindowRole())
}
