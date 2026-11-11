const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const folder = 'src/features/overlay';
const sources = (extension) =>
  fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(extension))
    .map((name) => ({ name, text: fs.readFileSync(path.join(folder, name), 'utf8') }));

// The floating bar follows the light and dark themes, so an icon drawn in a fixed white disappears on the light ground
// and leaves only its blue half. Its icons take the theme's foreground instead.
test('floating bar icons draw in the theme colour, never a fixed white', () => {
  const whiteIcon = /<(Brand\w+|AssistantGlyph|Icon)\b[^>]*\btext-white\b/;
  assert.deepEqual(
    sources('.tsx')
      .filter(({ text }) => whiteIcon.test(text))
      .map(({ name }) => name),
    [],
  );
});

// Text and lines in a fixed dark-theme grey read as heavy dark strokes on the light ground; only the blue accent is the
// same in both themes.
test('floating bar styles take text and line colours from the theme, keeping only the blue accent fixed', () => {
  const fixed = /^\s*(color|border(?:-[a-z]+)*):[^;]*#(?!2581ff\b)[0-9a-f]{3,6}\b/im;
  assert.deepEqual(
    sources('.css')
      .filter(({ text }) => fixed.test(text))
      .map(({ name }) => name),
    [],
  );
});
