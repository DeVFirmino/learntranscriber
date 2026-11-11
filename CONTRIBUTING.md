# Contributing

LearnTranscriber is a macOS app: an Electron main process, a React renderer and small Swift helpers. Issues and pull
requests are welcome.

## Before you build

- For anything bigger than a small fix, open an issue first so we agree on the change before you write it.
- For a bug, include your macOS version and Mac model, the steps, what you expected and what happened, and the relevant
  lines of `~/Library/Logs/LearnTranscriber/main.log` with anything private removed.

## Making a change

- Set up with [Build from source](README.md#build-from-source).
- Read [AGENTS.md](AGENTS.md) first. It is the project's contract: the layers, the dependency rule, module size,
  persistence through migrations and how tests are written.
- Give each new module its own focused test.
- Put any text the app shows in all three locale catalogs (`en`, `pt-BR`, `es`).
- Keep each commit to one concern, with a short imperative subject.

## Before opening a pull request

```sh
npm test          # backend
npm run ui:test   # renderer logic
npm run check     # syntax, prettier, oxlint
npm run ui:build  # tsc + vite
```

When `native/` changed, also run `cd native && swift build -c release && swift test`;
[AGENTS.md](AGENTS.md#gates-before-calling-work-done) lists the checks for main-process wiring. The full native smoke run
(`npm run smoke`) is run by a maintainer before a release, so you do not need to run it.

In the pull request, describe the change and how you verified it. For anything visual, add before-and-after
screenshots.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
