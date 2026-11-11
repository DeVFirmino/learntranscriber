# LearnTranscriber: rules for agents

Read this before changing code. It is the project contract; it outranks personal defaults. `CLAUDE.md` points here.

## Layout

```
src/main/                  Electron main process (CommonJS .cjs)
  domain/                  pure rules: no I/O, no Electron, no sqlite, no fs/net/os/child_process, no process.*
  application/             use cases and runtime state as createX({ deps }) factories; no infrastructure imports
  infrastructure/          adapters that touch the world: sqlite, electron, files, local, native, integrations, providers, credentials
  interface/ipc/           one thin controller per feature; register.cjs is the only ipcMain.handle; trusted-sender.cjs checks callers
  interface/desktop/       shortcut registration
  composition/             wiring per feature (one module each), and the root's phases (core, controls, services,
                           controllers, startup, lifecycle), which call the feature modules; nothing outside
                           composition/ and composition.cjs calls them
  composition.cjs          the composition root: runs the phases in start() order; no policy
  index.cjs, preload.cjs   entry points; preload maps IPC 1:1
  smoke*.cjs, smoke-hooks.cjs   native smoke harness; production code never knows about it
ui/src/                    React renderer: pages, features, components, settings, locales; bridge/ is the only Electron contact
native/                    Swift helpers: HelperKit, CommandKit, <Area>Core, <Area>Adapters, one thin command each
test/, ui/test/, native/Tests/   node:test, node:test over transpiled TS, Swift Testing
docs/reviews/              reports and verification JSON; .local/ is scratch and gitignored
```

## Dependency rule

Direction is `interface → application → domain` and `composition → everything`. `infrastructure` implements what
`application` needs and never imports `application` or `interface`. `domain` imports nothing outside `domain/` and Node's
pure built-ins (`node:crypto` is fine for hashing and signatures; `node:os`, `node:fs`, `electron`, `node:sqlite`,
`process.platform`, `process.env` are not: `test/domain-rules.test.cjs` fails the build on them). Platform, clock,
timers, randomness and `fetch` are injected by the composition, never read inside domain or application:
`test/injected-clock.test.cjs` fails the build on a direct read, including a default parameter that falls back to the
global.

No lazy `require()` to hide a cycle. If two modules need each other, split the shared rule into `domain/`.

## Injection and size

- Every application and infrastructure module is a factory or class that receives its dependencies as one object:
  `createX({ repository, transport, changed, now })`. Nothing reads a global, a singleton or a module-level instance.
- One responsibility per module, roughly under 150 lines; adapters that wrap one external API may reach 250. Anything
  larger is split by responsibility (catalog vs download vs launch; auth flow vs token storage). No "manager", "service",
  "utils", "helpers" or "common" files.
- Callers receive only the repository or port they use, never a bundle of everything (`createRepositories` is for the
  composition, tests and smoke only).
- Delete old code; no forwarders, no re-exports kept "for compatibility", no commented-out blocks.
- No nested ternaries. Comments only where the logic is not self-evident, and they say why, not what.

## SOLID, in this codebase's terms

- **Single responsibility:** one reason to change per module. A module that parses, decides and persists is three modules.
- **Open/closed:** add behaviour by adding a module (a strategy, a handler, a migration, a provider) and registering it in the composition, not by growing an `if`/`switch` spread across existing modules. Provider strategies and migrations are the model.
- **Liskov substitution:** every implementation of a port (the real adapter, the test fake, the renderer mock) honours the same contract: same return shapes, same errors, same cancellation behaviour. Contract tests (like `ui/test/mock-contract.test.cjs`) pin it where two implementations exist.
- **Interface segregation:** a factory receives only the methods it calls (`{ addEntry }`, not a repository bundle; one callback, not the whole leases object). Preload and bridge methods stay grouped by feature.
- **Dependency inversion:** application code depends on the port (the object shape it is given), never on `require`ing an infrastructure module; only the composition knows concrete adapters.

Every spec in `docs/plans/` ends its design with a short SOLID check, and reviews check new code against it.

## Persistence

`infrastructure/sqlite/database.cjs` opens the workspace and runs `infrastructure/sqlite/migrations/` in order, tracked
by `PRAGMA user_version`. Schema changes are a new numbered migration file, never an edit to an applied one and never an
inline `CREATE`/`ALTER` elsewhere. One repository per table group; SQL lives only in `infrastructure/sqlite/`.

## Interface

A controller validates shape and caller, then calls one use case. No business rules in `interface/`, `preload.cjs` or the
renderer bridge. New IPC channels: add the handler in the feature's controller, the 1:1 method in `preload.cjs`, the type
and the method in the feature's file under `ui/src/bridge/types/` (its `XApi` interface, which `api.ts` composes) and the
mock in `ui/src/bridge/mock/`.

## UI

Pure logic goes in `.ts` modules under `ui/src/features/` with a node test in `ui/test/` (loaded through
`helpers/load-ts.cjs`, so they stay dependency-free); components only render. Text goes through the three locale catalogs
(`en`, `pt-BR`, `es`), which must stay key-identical (`ui/test/i18n.test.cjs`). Keep the approved graphite/indigo look,
blue icon family and compact option B; no Premium, subscriptions, credits, referrals, Help or Tutorial pages. Anything
visual is shown on a local before/after board before it ships.

## Native (Swift)

Swift 6 language mode, tools 6.2, warnings are errors. `<Area>Core` imports only Foundation (and HelperKit at most) and
is unit-tested; `<Area>Adapters` wraps Apple frameworks behind small protocols; the command parses arguments and
dispatches. One type per file. No force unwraps, no GCD except where Core Audio or ScreenCaptureKit force a queue, no
`@unchecked Sendable`, no `Task.detached`, no `MainActor.assumeIsolated`. Timeouts go through `withTimeout`; stdin through
`StandardInputReader`; output only through `LineWriter`. The JSON wire format, flags, messages and exit codes are pinned by
`test/native-helpers.test.cjs`; changing one needs that test and the `src/main` consumer updated together.

## Tests

Every new module ships with its own focused test: plain object fakes passed into the factory, a real in-memory database
(`openDatabase(':memory:')`) for repositories, no Electron, no network, no real microphone or audio, no paid inference,
no writes to a user vault. Fixtures live in `test/fixtures/`. Do not weaken or delete an assertion to make a
refactor pass; move it with the code.

## Gates before calling work done

```sh
npm test                     # backend, must stay green (718 at the last checkpoint)
npm run ui:test              # renderer logic
npm run check                # syntax, prettier (run npm run format first), oxlint
npm run ui:build             # tsc + vite
cd native && swift build -c release && swift test   # when native/ changed; then npm run native:build
node --test test/native-helpers.test.cjs            # when native/ or its consumers changed
LEARNTRANSCRIBER_SMOKE_FOCUS=session-behaviors node scripts/smoke.cjs      # focused native smokes, once each,
LEARNTRANSCRIBER_SMOKE_FOCUS=functional-workflows node scripts/smoke.cjs   # when main-process wiring or native changed
```

`npm run smoke` (the full native run) and replacing the installed app need an explicit request from the owner.

## Commits and history

Small commits, one concern each, short imperative English subject, no body unless needed, no AI attribution of any kind
(no Co-Authored-By naming a model, no "Generated with", no emoji). Stage explicit paths only; never `git add -A`. Do not
reset, rebase or force-push shared history without being asked.

## Scope

Do not add controls or broaden product behavior beyond what the owner asked for. State the plan in one or two lines before building, announce any dependency added or
removed, keep experiments on a branch, and do not broaden a task beyond what was asked.
