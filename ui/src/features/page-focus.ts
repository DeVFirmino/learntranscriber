interface Focusable {
  focus(options?: FocusOptions): void
}
interface PageRegion extends Focusable {
  contains(node: unknown): boolean
  querySelector(selector: string): Focusable | null
}

// After a page change, focus moves to the new page's title so a screen reader announces where the user is, unless
// something in the new page already took focus (the ask shortcut focuses the chat box, for example).
export function focusNewPage(main: PageRegion | null, active: unknown) {
  if (!main || main.contains(active)) return
  const target = main.querySelector('h1[tabindex="-1"]') ?? main
  target.focus({ preventScroll: true })
}
