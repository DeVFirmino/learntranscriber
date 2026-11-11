const fs = require('node:fs');
const path = require('node:path');
const icons = require('../ui/src/brand/icons.json');
const { blue } = require('../ui/src/brand/mark.json');

// Standalone exports of the same paths used by BrandIcon. No raster converter or font is required.
const destination = path.join(__dirname, '../assets/brand/icons');
fs.mkdirSync(destination, { recursive: true });
for (const [name, shape] of Object.entries(icons)) {
  const foreground = `<path class="fg" d="${shape.foreground}" stroke="currentColor"/>`;
  const accent = `<path class="accent" d="${shape.accent}" stroke="${blue}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${foreground}${accent}</svg>\n`;
  fs.writeFileSync(path.join(destination, `${name}.svg`), svg);
}
console.log(`Exported ${Object.keys(icons).length} brand icons.`);
