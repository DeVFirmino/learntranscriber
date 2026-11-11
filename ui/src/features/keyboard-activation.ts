// Enter and Space activate an element that is not a native button, as they would a button.
// https://www.w3.org/WAI/ARIA/apg/patterns/button/
const ACTIVATION_KEYS = new Set(['Enter', ' '])

export function onActivationKey(activate: () => void) {
  return (event: { key: string; preventDefault: () => void }) => {
    if (!ACTIVATION_KEYS.has(event.key)) return
    event.preventDefault()
    activate()
  }
}
