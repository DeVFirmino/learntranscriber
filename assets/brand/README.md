# LearnTranscriber identity

The approved two-part conversation mark is a hand-redrawn vector adaptation of the supplied logo reference. It preserves the light/dark treatment and blue accent; the contours are not a pixel-exact extraction of the raster artwork.

- `ui/src/brand/mark.json` is the shared path and color source.
- `ui/src/components/brand.tsx` renders the theme-aware interface symbol and wordmark.
- `mark-light.svg` and `mark-dark.svg` are transparent standalone marks.
- `mark-monochrome.svg` is the single-color version.
- `app-icon.svg` is the dark macOS tile; `app-icon-light.svg` is its light alternative.
- `assets/icon.png` is the default 1024×1024 application icon with transparent outer padding.
- `assets/trayTemplate.png` and `trayTemplate@2x.png` are 24/48px monochrome template images. macOS supplies their displayed color.
- `ui/public/favicon.svg` follows the browser's preferred color scheme.

Regenerate assets with `node scripts/build-brand.cjs`. This requires the existing `rsvg-convert` CLI from librsvg; no npm dependency was added. The generated assets are committed so normal builds do not need this tool.

The app remains dark by default. The light identity assets do not introduce a new application theme. Narrow headers show the symbol with an accessible home-link name; larger headers also show the wordmark. Native stealth and privacy behavior are unchanged.

Validation: TypeScript/Vite build, 25 existing UI tests and JavaScript syntax checks passed. Desktop/mobile review covers 1280, 390 and 320px. No tests were added for this visual change. Existing lint and bundle-size advisories remain. The separate unsigned review package is `dist/logo-review/mac-arm64/LearnTranscriber.app`; it does not replace or restart the existing application.


## Blue Relay icons — 2026-10-30

The approved B direction, **Two voices**, extends the existing two-part conversation mark into 26 functional glyphs.
`ui/src/brand/icons.json` stores their editable paths; `ui/src/components/brand-icon.tsx` renders them in the workspace,
settings and floating surfaces. Small utility controls retain simple Lucide outlines. The app mark and macOS tile stay.

The icon accent is `#2581ff`; small light-surface icons use `#1764c7` for contrast. The existing interface palette,
surfaces, typography, spacing and controls are preserved. This direction changes glyphs only.

`node scripts/build-brand-icons.cjs` exports the standalone SVGs in `assets/brand/icons/` from the shared paths.
The direction and its size comparisons were approved on a local review board.

`listen.svg` is the Start listening microphone. Filled primary buttons render both parts in the button foreground
for contrast; neutral surfaces use the normal two-color treatment. [DESIGN.md](../../DESIGN.md) records the visual system.

## Two halves icons — 2026-11-08

Direction C replaces the filled Blue Relay glyphs with split outlines: each icon is one contour divided into a
foreground part (`class="fg"`, `currentColor`) and a blue part (`class="accent"`), drawn at a 2-unit stroke on the
24 grid. The family has 27 glyphs, including `notch` for the Notch Experience. Destination and feature icons that were
Lucide (Home, Sessions, Assistants, Settings, listen, capture, stealth, screen, transcript, audio, calendar, privacy)
now use it; utility actions stay Lucide at its default weight. The exported SVGs no longer fix a colour, so they work
on dark and light surfaces.
