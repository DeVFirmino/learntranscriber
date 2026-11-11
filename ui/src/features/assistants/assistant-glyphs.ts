// The blue mark an assistant shows beside the person glyph, drawn in the icon family's outline (2-unit stroke) inside
// the 14-22 by 2-10 corner, clear of the person. Built-in roles have their own mark; General keeps the plain person.
export const ROLE_MARKS: Record<string, string> = {
  math: 'M15.5 4.5h5M18 2v5M15.5 9.5h5',
  english: 'M14.5 10L18 2l3.5 8M15.8 7h4.4',
  programming: 'M16.5 2.5L14 6l2.5 3.5M19.5 2.5L22 6l-2.5 3.5',
  meeting: 'M14 2.5h8M14 6h8M14 9.5h5',
}

// The avatars a custom assistant or a session can get, from the approved 16-symbol set (an asterisk, a ring, a diamond, waves, a
// leaf, a star, a bolt, a heart, a speech bubble, a check, a music note, a bookmark, a triangle, a hash, a sun and a
// moon, which replaced the globe), redrawn in the same corner with fewer details so they stay legible at the family's
// weight.
export const CUSTOM_MARKS = [
  'M18 2v8M14.5 4l7 4M21.5 4l-7 4',
  'M14.5 6a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0',
  'M18 2l4 4-4 4-4-4z',
  'M14 4.5q2-2 4 0t4 0M14 8.5q2-2 4 0t4 0',
  'M14.5 9.5C14.5 4.5 17 2.5 21.5 2.5C21.5 7 19 9.5 14.5 9.5zM14.5 9.5L19 5',
  'M18 2L19.5 4.14L21.99 4.9L20.43 6.99L20.47 9.6L18 8.75L15.53 9.6L15.57 6.99L14.01 4.9L16.5 4.14Z',
  'M19 2l-4 4.5h4l-1 3.5 4-4.5h-4z',
  'M18 9.5C16.5 8.3 14 6.6 14 4.6C14 3.1 15.1 2.2 16.3 2.2c.8 0 1.4.4 1.7 1c.3-.6.9-1 1.7-1c1.2 0 2.3.9 2.3 2.4c0 2-2.5 3.7-4 4.9z',
  'M14 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3.5L14 10z',
  'M14.5 6.5l2.5 2.5 4.5-6',
  'M20 8.25a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 1 1 3.5 0M20 8.25V2.5l2 1',
  'M15.5 2h5v8L18 8.25L15.5 10z',
  'M18 2.5l4 7h-8z',
  'M16.5 2l-1 8M20.5 2l-1 8M14.5 4.5h7.5M14 7.5h7.5',
  'M16.2 6a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0M18 2h.01M18 10h.01M14 6h.01M22 6h.01M15.2 3.2h.01M20.8 3.2h.01M15.2 8.8h.01M20.8 8.8h.01',
  'M22 7A4.2 4.2 0 1 1 17 2a3.4 3.4 0 0 0 5 5z',
]

// A stable pick from an id, so a new custom assistant or session gets an avatar at random and keeps it without storing
// anything.
export function randomMark(id: string): string {
  let hash = 0
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0
  return CUSTOM_MARKS[hash % CUSTOM_MARKS.length]
}

export function roleMark(id: string, builtIn: boolean): string | undefined {
  if (Object.hasOwn(ROLE_MARKS, id)) return ROLE_MARKS[id]
  return builtIn ? undefined : randomMark(id)
}
