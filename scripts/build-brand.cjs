const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mark = require('../ui/src/brand/mark.json');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'assets/brand');
fs.mkdirSync(dir, { recursive: true });
const paths = (upper, lower) => `<path fill="${upper}" d="${mark.upper}"/><path fill="${lower}" d="${mark.lower}"/>`;
const svg = (body, viewBox = mark.viewBox) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;
for (const [name, upper, lower] of [
  ['mark-light', '#171819', mark.blue],
  ['mark-dark', '#faf9f7', mark.blue],
  ['mark-monochrome', '#000', '#000'],
])
  fs.writeFileSync(path.join(dir, name + '.svg'), svg(paths(upper, lower)));
const icon = svg(
  '<rect x="88" y="88" width="848" height="848" rx="188" fill="#171819"/><g transform="translate(222 294) scale(2.265625)">' +
    paths('#faf9f7', mark.blue) +
    '</g>',
  '0 0 1024 1024',
);
fs.writeFileSync(path.join(dir, 'app-icon.svg'), icon);
fs.writeFileSync(
  path.join(dir, 'app-icon-light.svg'),
  icon.replace('fill="#171819"', 'fill="#faf9f7"').replace('fill="#faf9f7" d=', 'fill="#171819" d='),
);
execFileSync('rsvg-convert', [
  '-w',
  '1024',
  '-h',
  '1024',
  '-o',
  path.join(root, 'assets/icon.png'),
  path.join(dir, 'app-icon.svg'),
]);
const tray = svg('<g transform="translate(2 5) scale(.125)">' + paths('#000', '#000') + '</g>', '0 0 36 36');
fs.writeFileSync(path.join(dir, 'tray.svg'), tray);
for (const [name, size] of [
  ['trayTemplate.png', 24],
  ['trayTemplate@2x.png', 48],
]) {
  execFileSync('rsvg-convert', [
    '-w',
    String(size),
    '-h',
    String(size),
    '-o',
    path.join(root, 'assets', name),
    path.join(dir, 'tray.svg'),
  ]);
}
fs.writeFileSync(
  path.join(root, 'ui/public/favicon.svg'),
  svg(
    '<style>.upper{fill:#171819}@media(prefers-color-scheme:dark){.upper{fill:#faf9f7}}</style>' +
      `<path class="upper" d="${mark.upper}"/><path fill="${mark.blue}" d="${mark.lower}"/>`,
  ),
);
console.log('Built SVG marks, 1024px app icon, adaptive favicon and template tray images.');
