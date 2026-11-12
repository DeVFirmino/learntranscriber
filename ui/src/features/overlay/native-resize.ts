// The bar window grows in the main process, but this page sees its new height, and the resize event that dismisses a
// Radix Select, some frames later; on a busy Mac that is more than the two frames a popup used to wait. Waits until the
// height differs from the one read before asking, then one more frame so that resize event has already fired. A window
// that was already the right size never changes, so the wait gives up after about a third of a second.
export const RESIZE_FRAMES = 20

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export async function afterNativeResize(heightBefore: number): Promise<void> {
  for (let frame = 0; frame < RESIZE_FRAMES && window.innerHeight === heightBefore; frame++) await nextFrame()
  await nextFrame()
}
