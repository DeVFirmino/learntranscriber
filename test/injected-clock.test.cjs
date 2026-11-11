const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

// AGENTS.md: clock, timers, randomness and `fetch` are injected by the composition, never read in domain or
// application. A module reaches them only through what it is given, such as `timers.setTimeout` or `now()`.
const FORBIDDEN = [
  [/(?<![.\w$])(setTimeout|clearTimeout|setInterval|clearInterval|setImmediate)\b/, 'a global timer'],
  [/\bDate\.now\b|new Date\(\s*\)/, 'the clock'],
  [/\bMath\.random\b|(?<![.\w$])random(UUID|Bytes|Int)\b|\bcrypto\.random\w*/, 'randomness'],
  [/(?<![.\w$])fetch\(/, 'the network'],
];
const root = join(__dirname, '..');

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

// Comments may name the globals they explain; blanking them keeps the line numbers.
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/.*$/gm, '$1');

test('domain and application read the clock, timers and randomness only through what they are given', () => {
  const found = [];
  for (const layer of ['domain', 'application'])
    for (const file of sources(join(root, 'src/main', layer)))
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, index) => {
          for (const [pattern, what] of FORBIDDEN)
            if (pattern.test(line)) found.push(`${relative(root, file)}:${index + 1} reads ${what}`);
        });
  assert.deepEqual(found, []);
});
