# LearnTranscriber UI

Vite + React + TypeScript replacement frontend. Official shadcn (`radix-nova`) and Tailwind CSS 4. See [Electron integration](../docs/UI_INTEGRATION.md).

```sh
npm ci
npm run dev
npm run build
```

`npm run dev` is for local preview. Production loads `dist/index.html` with relative URLs. The Electron app uses its native bridge. Only loopback HTTP previews without a bridge use labeled sample data; production file URLs fail closed when the bridge is missing.
