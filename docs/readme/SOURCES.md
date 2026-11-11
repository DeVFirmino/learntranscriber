# Sources for the README illustrations

Every image and font embedded in `docs/readme/*.svg` is a base64 data URI, so each SVG stays
self-contained and renders with no network access, as GitHub requires for a README image. No
new image was generated for this pass: every illustration reuses an existing asset from the
presentation site (`presentation-site/site/img/`) or a screenshot of that site taken locally.
Higgsfield credits used for this change: **0**.

## Reused from the presentation site

The site's own provenance lives in `presentation-site/site/img/SOURCES.md` and
`presentation-site/site/img/objects/SOURCES.md` (read-only worktree, not part of this repo).
Copied here for a self-contained record:

- **`img/objects/whiteboard.webp`, `headphones.webp`, `microphone.webp`, `bubble.webp`,
  `notebook.webp`** (no longer used here; listed for the record) — five 3D illustrated objects generated together with
  Higgsfield GPT Image 2 (job `b2f6bf7c-6a96-4b5b-be8a-0714c228f2c6`, 21:9, 2k, high quality),
  background removed with Higgsfield's image background remover (job
  `6dca1dc1-23d2-47c3-bf2b-45e0874b7478`), then cropped apart and saved as WebP at 640px. Style:
  soft clay-like 3D render, matte smooth plastic, brand blue / white / graphite palette, no text,
  no logos, no people.
- **`img/assistants/english.webp`, `math.webp`, `programming.webp`, `note-taker.webp`,
  `general.webp`** (used in `assistants.svg`) — 3D busts of the five built-in assistants,
  generated with Higgsfield GPT Image 2 (job `e11f4e2a-6f10-40d1-84b0-241ada19cb67`, 21:9, 2k,
  high) from a sheet of the app's own assistant glyphs as reference, on a chroma green background
  keyed out afterwards; each icon sits on its own 462×543 canvas, off-centre by design (the
  README shifts each figure right by the percentage of its own width noted in the task: English
  13.2%, Math 10.7%, Programming 14%, Note Taker 14.6%, General 0%, matching the site's own
  `--center` CSS custom properties in `styles.css`).
- **Geist Variable** (`fonts/geist-latin-wght-normal.woff2`) — Copyright 2024 The Geist Project
  Authors, SIL Open Font License 1.1. Used for all body/heading text in every SVG except
  `maker.svg`'s name.
- **Alegreya** (`fonts/alegreya-latin.woff2`) — Copyright 2011 The Alegreya Project Authors, SIL
  Open Font License 1.1. Used only for "daniel dias" in `maker.svg`, matching the site's footer
  lockup and danieldias.dev.

- **`logo.webp`** (used at the top of the README) — the presentation site's `img/logo-3d.webp`, copied as is: the
  LearnTranscriber logo in 3D, made with Higgsfield GPT Image 2 (job `99caf025-3790-4346-b875-a62152dc8cd2`, 1:1, 1k,
  high) from the app's logo (`ui/public/favicon.svg`) as the reference, on a chroma green background keyed out
  afterwards.

- **`badges/*.svg`** (the pills at the top of the README) — drawn locally in the website's pill style (white fill,
  `#dde3ec` border, soft shadow, brand blue `#2581ff` icons, `#3d4655` text; Website filled in brand blue). The labels
  are Geist at weight 600 converted to outlines with fontTools, so the files need no font; the icons are
  [Lucide](https://lucide.dev) (scale, laptop, cpu, git-pull-request, globe, download, bot, users, coffee), ISC license,
  Copyright (c) Lucide Contributors, read from the renderer's `lucide-react` package. No image was generated for them.

## Captured or drawn locally

- **`hero.webp`** — composed from the presentation site's original files, not a screen recording. The site's
  MacBook scene (`site/index.html` with `img/macbook.webp`) was rendered once at 2× with its two video elements hidden,
  at the moment the panel shows a question and its answer. The original `img/call/teacher.mp4` (960×540) and
  `img/call/student.mp4` (640×360) were then placed into those two spots with ffmpeg, cropped like the page's
  `object-fit: cover`, under a foreground layer that keeps the name labels and the student tile's border on top. The
  7.4-second loop is 1800 px wide at 20 frames per second, encoded with `img2webp`. Everything in it is the site's
  sample content: the people are AI-generated footage (provenance in `presentation-site/site/img/SOURCES.md`), and the
  answers are scripted examples.
- **`architecture.svg`** — the system design, drawn in Excalidraw. The source is the element
  skeleton in `architecture.skeleton.json` next to this file; it was converted with
  `convertToExcalidrawElements` and exported with `exportToSvg` from `@excalidraw/excalidraw`
  0.18.1 in a local page, so the Excalifont subset is embedded and nothing is fetched at view time.
  The boxes follow the real layout in `AGENTS.md` and `src/main/`.
- **`assistants.svg`, sixth figure** — the dashed "Your own" outline with the plus sign is plain
  SVG geometry drawn by hand in the same file; no image was generated for it.

## Not generated

No Higgsfield image was created for this README. `assistants.svg`'s busts reuse the site's existing WebP files; `maker.svg` is flat, hand-drawn SVG
geometry (two terracotta `<rect>`s) with no raster image at all, matching Daniel's instruction to
never render that lockup in 3D.
