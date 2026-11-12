# Image and video sources

- `macbook.webp`: AI-generated laptop in the style of a 16-inch MacBook Pro, not an Apple asset. Made with Higgsfield
  GPT Image 2 (job `506c6172-06b6-4b2d-bf2b-0c6e2e6f01c4`) with a chroma green screen; the white background and the
  green screen were then cut out and the image cropped to 2220 × 1343. Prompt: "Photorealistic studio product render of
  a modern silver aluminum laptop in the style of a 16-inch MacBook Pro, seen perfectly straight from the front at the
  height of the screen's center, lid open and the screen facing the camera squarely, so the screen is an exact upright
  rectangle with no perspective tilt. Only the thin front edge of the aluminum base is visible as a slim strip below the
  screen, slightly wider than the screen, with the small thumb notch in the middle; the keyboard is not visible. The
  whole screen inside its thin uniform black bezel is filled edge to edge with one perfectly flat, uniform pure chroma
  green color (#00FF00): no reflections, no glare, no gradient, no content, no notch cutout. Crisp edges, realistic
  aluminum finish, high detail. Centered and filling most of the frame, isolated on a pure white seamless background
  with a soft contact shadow under the base. Even studio lighting. No logos, no text, no brand marks, no stickers."
- `objects/`: Higgsfield illustrations; prompt and jobs in `objects/SOURCES.md`.
- `assistants/`: 3D icons of the five assistants that come with the app (English, Math, Programming, Note Taker,
  General). Made with Higgsfield GPT Image 2 (job `e11f4e2a-6f10-40d1-84b0-241ada19cb67`, 21:9, 2k, high) from a sheet of
  the app's own assistant glyphs as the reference, on a chroma green background that was keyed out afterwards; each icon
  sits on the same 462 × 543 canvas. Prompt: "Five separate 3D illustrated icons in a single horizontal row, one for each
  flat icon in the reference image, in the same order from left to right, keeping each icon's design: a person (round
  head and rounded shoulders) with a symbol at its upper right. Left to right the symbols are: (1) a capital letter A;
  (2) a plus-minus sign; (3) a pair of angle brackets; (4) three stacked horizontal bars, the bottom one shorter, like
  lines of notes; (5) no symbol, only the person. Turn each into a solid, friendly 3D object: the person as a smooth
  rounded bust (a sphere head on soft rounded shoulders, no face, no features) in soft deep graphite (#15171d) matte
  plastic with gentle highlights, and the symbol as a chunky rounded 3D shape in bright brand blue (#2581ff), floating
  just above the person's shoulder. Style: soft clay-like 3D render, matte smooth plastic, rounded friendly
  proportions, slight three-quarter view, soft studio light from the top left, small white accents allowed. Playful and
  premium, like modern app marketing illustrations. Each icon is complete, centered in its own fifth of the image with
  generous empty space around it, never touching another. Perfectly flat, uniform pure chroma green background
  (#00FF00) everywhere around the icons, with no shadows, no floor, no gradient, and no green reflections on the icons.
  No other text, letters or numbers besides the symbols listed, no logos, no extra objects."
- `app-icon-3d.webp`: the LearnTranscriber app icon in 3D, a white rounded tile with the 3D logo on it. Made with
  Higgsfield GPT Image 2 (job `a868a62e-5822-4c54-9846-21f807014ceb`, 1:1, 1k, high) from `logo-3d.webp` as the
  reference, on a chroma green background that was keyed out afterwards. Prompt: "A macOS app icon rendered in 3D: a
  rounded-square squircle tile with soft depth and a gentle bevel, in glossy white with a very light cool gray gradient,
  seen from the front with a very slight tilt. On the tile, centered and filling about two thirds of it, the logo from
  the reference image: the same two curved halves with the same silhouettes, the upper half deep graphite (#15171d)
  and the lower half bright brand blue (#2581ff), raised from the tile like soft clay with a satin sheen. Soft studio
  light from the top left. The tile is centered with generous empty margins on a perfectly flat, uniform pure chroma
  green background (#00FF00), with no shadow, no floor, no gradient and no green reflections. No text, no letters, no
  other objects."
- `open-lock.webp`: an open padlock with a small code tag, for the "Built in the open" block. Made with Higgsfield GPT
  Image 2 (job `121566bd-bc15-4a31-8c53-059fbae29d4f`, 1:1, 1k, high) on a chroma green background that was keyed out
  afterwards. Prompt: "One 3D illustrated icon: an open padlock, its shackle lifted and swung open, in bright brand blue
  (#2581ff) with a white face plate, and hanging from the shackle a small rounded graphite (#15171d) tag showing the
  characters </> in white. Style: soft clay-like 3D render, matte smooth plastic, rounded friendly proportions, slight
  three-quarter view, soft studio light from the top left, small white accents allowed. Playful and premium, like modern
  app marketing illustrations. The object is centered with generous empty margins on a perfectly flat, uniform pure
  chroma green background (#00FF00), with no shadow, no floor, no gradient and no green reflections on the object. No
  other text, letters or objects."
- `sources/`: generic 3D icons for the kinds of apps on the "Works with what you use" tiles: a video player, a webcam
  and a grid of call tiles, with no brand marks. YouTube, Zoom and Google Meet do not allow altered versions of their
  logos, so the tiles name them in text instead. Made with Higgsfield GPT Image 2 (job
  `281171fd-0585-41ec-bab9-bd45c65c30dd`, 21:9, 1k, high) on a chroma green background that was keyed out afterwards.
  Prompt: "Three separate 3D illustrated icons in a single horizontal row with generous empty space between them; each
  icon is complete, centered in its own third of the image, and never touches another. Left to right: (1) a small
  rounded video screen with a big play triangle in the middle, a generic video player; (2) a small webcam on a little
  stand with a round lens; (3) a two-by-two grid of rounded video-call tiles, each tile with a simple person silhouette.
  Style: soft clay-like 3D render, matte smooth plastic, rounded friendly proportions, slight three-quarter view, soft
  studio light from the top left. Strict palette: bright brand blue (#2581ff), white, very light cool gray, and small
  deep graphite (#15171d) accents. Perfectly flat, uniform pure chroma green background (#00FF00) everywhere around the
  icons, with no shadows, no floor, no gradient and no green reflections on the icons. No text, no letters, no
  numbers, no logos, no brand marks." The lecture tile reuses `objects/whiteboard.webp`.
- `logo-3d.webp`: the LearnTranscriber logo in 3D. Made with Higgsfield GPT Image 2 (job
  `99caf025-3790-4346-b875-a62152dc8cd2`, 1:1, 1k, high) from the app's logo (`ui/public/favicon.svg`) as the reference,
  on a chroma green background that was keyed out afterwards. Prompt: "Turn the logo in the reference image into one 3D
  object, keeping the exact silhouettes, proportions and arrangement of its two curved halves: the upper half deep
  graphite (#15171d) and the lower half bright brand blue (#2581ff), separated by the same gap. Each half becomes a
  thick, smooth, rounded 3D shape with soft bevelled edges, like soft clay-like matte plastic with a subtle satin sheen;
  slight three-quarter view, soft studio light from the top left. Centered with generous empty margins on a perfectly
  flat, uniform pure chroma green background (#00FF00), with no shadow, no floor, no gradient and no green reflections
  on the object. No text, no letters, no other objects."
- `call/teacher.jpg`, `call/teacher.mp4`: AI-generated sample footage, not a real person. Still made with Higgsfield
  GPT Image 2 (job `e5df6d3b-b3c6-4f7d-8e77-e93b2a01bdd6`), animated with Veo 3.1 Lite (job
  `f6ec4306-b523-4b11-a128-91a006a1249a`), then looped with a 0.6 s crossfade and re-encoded at 960 px without sound.
  Prompts:
  - Still: "A friendly English teacher in his late thirties with a short beard and round glasses, wearing a light denim
    shirt, sitting at his desk in a bright study with a small whiteboard and a shelf of books behind him; mid-sentence,
    smiling and gesturing lightly with one hand, looking at the camera, framed from the chest up. Candid frame from a
    real video call, as seen through a laptop webcam: natural colors, soft window light, slight webcam softness and real
    skin texture, not posed, not glamorous, not a stock photo. No text, no letters, no logos, no watermark, no on-screen
    interface."
  - Motion: "He explains the lesson to the camera naturally: talking with clear lip movement, relaxed hand gestures, a
    small nod and a warm smile, natural blinking and small head movements, like a real teacher on a video call. Static
    laptop-webcam framing, no camera movement, no cuts, no text, no subtitles."
- `call/student.jpg`, `call/student.mp4`: AI-generated sample footage, not a real person. Still made with Higgsfield
  GPT Image 2 (job `c3e12438-4e36-4747-a794-f871c49072b5`), animated with Veo 3.1 Lite (job
  `093a3fd0-d361-4e90-be32-54832521e3b7`), looped the same way and re-encoded at 640 px. Prompts:
  - Still: "A university student in her early twenties wearing small wireless earbuds, listening to a lesson in her
    dorm room in the evening, warm lamp light and out-of-focus shelves behind her; she has just looked up from her
    notebook with a slight smile, framed from the shoulders up." plus the same candid-webcam guidance as the teacher.
  - Motion: "She listens to the online lesson, glances down to write a quick note, then looks back at the screen and
    nods with a small smile. Natural blinking and small movements. Static laptop-webcam framing, no camera movement, no
    cuts, no text, no subtitles."
- `meet/ana.*`, `meet/leo.*`, `tutorial/dev.*`: AI-generated sample footage, not real people, animated with Higgsfield
  Veo 3.1 Lite and looped like the class videos:
  - Ana (video job `3e5b77a9-ab4f-4458-bc7b-8947e88c4783`): still from GPT Image 2 (job `71211f72-6518-4537-888c-5dfff68de8b9`, the "warm English teacher in her
    mid-forties" prompt), motion: "She leads a weekly team meeting on a video call, talking naturally to the camera about
    the plan: clear lip movement, relaxed hand gestures, a nod and a friendly smile, natural blinking. Static
    laptop-webcam framing, no camera movement, no cuts, no text, no subtitles."
  - Leo (video job `cc79ced2-7806-4711-a484-c41e04cab76e`): still from GPT Image 2 (job `5b1ecb27-0a95-4fbb-b147-f806d9f3366a`, the "young man in his early twenties
    wearing a gray hoodie" prompt), motion: "He listens to a colleague on a video call, nods, takes a quick note and
    smiles, with natural blinking and small movements. Static laptop-webcam framing, no camera movement, no cuts, no
    text, no subtitles."
  - Tutorial instructor (video job `4379b9cb-0dc5-4b10-b5d9-70e280e50cd6`): still from GPT Image 2 (job `47d34549-f3cb-48eb-a0af-c1abe5f88333`), prompt: "A software
    developer in her early thirties recording a programming tutorial with her webcam: short dark hair, small headset
    microphone, gray t-shirt, sitting in a tidy home office with a second monitor glowing softly behind her and a small
    plant; mid-sentence, explaining with a calm smile, looking at the camera, framed from the shoulders up." plus the
    candid-webcam guidance; motion: "She explains her code to the camera in a calm, natural way: talking with clear lip
    movement, a small hand gesture, glancing briefly at her screen and back, natural blinking. Static webcam framing, no
    camera movement, no cuts, no text, no subtitles."
- `og.png`: the link-preview (Open Graph / Twitter Card) image, not AI-generated. Composed from the site's own assets
  (`logo-3d.webp`, `macbook.webp`, `call/teacher.jpg`, `call/student.jpg`) and `styles.css`'s real classes, laid out in a
  standalone 1200 × 630 HTML page and captured with headless Chrome.
