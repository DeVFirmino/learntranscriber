---
name: LearnTranscriber
description: A graphite conversation workspace with blue and white outline controls and task-based navigation.
colors:
  brand-blue: "#2581ff"
  brand-icon-light-surface: "#1764c7"
  navigation-background: "#15171d"
  navigation-active: "#1b2c44"
  navigation-active-foreground: "#e4efff"
  settings-background: "#111216"
  settings-card: "#191b22"
  settings-border: "#2b2e39"
typography:
  body:
    fontFamily: "Geist Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  navigation:
    fontSize: "13px"
    fontWeight: 400
spacing:
  control: "8px"
  group: "16px"
  section: "24px"
---

# LearnTranscriber design conventions

This records the implemented and owner-approved direction. Product behavior comes from `AGENTS.md` and the source; historical reference screenshots do not override the owner's later navigation and color decisions.

## Identity and color

Preserve the original app mark and blue/white identity. The owner rejected purple/indigo as the accent. Use graphite surfaces, restrained borders, readable foregrounds and blue for identity details, current selection and primary actions. Keep recording, warning, success and destructive colors meaningful.

The Home background animation is preserved. Floating surfaces support the existing light/dark preference with their own tokens. Do not imply that cloud processing stays local; provider and integration state must reflect the actual configuration and capability.

## Navigation

Five primary destinations: Home, Sessions, Assistants, Connections, Settings. Settings stays in the main left navigation and never replaces the entire shell. On narrow windows, the existing compact navigation adapts without removing labels or current location.

- Sessions contains history and the active conversation; an open session keeps Sessions selected.
- Connections has Apps & notes, Agents & reviews and Advanced MCP. A capability has one configuration destination.
- Settings expands to General, Audio & screen, AI & models, Behavior, Privacy, Permissions, Shortcuts and Data & email.
- AI setup separates connecting a provider from choosing models. Assistants represents instructions, not providers.
- Privacy behavior and OS permissions remain distinct. Hiding windows remains an immediate header action.
- General owns language/appearance. Data & email owns summary delivery and confirmed history deletion.

Use explicit page headings, descriptions and breadcrumbs. `aria-current="page"` marks the displayed leaf link; Settings indicates that its subnavigation is expanded. Contextual links open canonical destinations. Preserve prior deep links through the tested route mapping.

## Icons

Destinations and features use the app's own "two halves" family (`ui/src/brand/icons.json`): each glyph is one outline split in two with a 2.5-unit gap, the top or left part in the foreground colour and the bottom or right part in blue, like the two forms of the mark. Outline only, 2-unit stroke on the 24 grid (2.25 at 16px and below), round caps and joins, radius 2 on rectangles. Actions and utilities (arrows, chevrons, check, close, edit, delete, loading) stay Lucide at its default 2-unit stroke, with no blue detail. Navigation glyphs are 20px; compact actions and floating tabs use 16–20px.

Use familiar meanings: house for Home, notebook for Sessions, assistant for instructions, plug for Connections, gear for app Settings. Sliders indicate local panel adjustments. Send, copy, start, pause, stop and resize must remain distinguishable.

Visible menu labels accompany icons. Decorative icons are hidden from accessibility APIs; icon-only controls have a localized accessible name and tooltip/title. Keep the LearnTranscriber logo unchanged. Named third-party tools, providers and model makers use original artwork bundled in `ui/public/brands/`, with source URLs and hashes in `sources.json`. Preserve their colors and proportions; status is shown separately, never by dimming or recoloring a product logo. Existing specialized brand glyphs remain where their features still use them.

## Content and controls

One primary task per screen. Use headings and spacing to group controls before adding containers. Body text uses the existing Geist/system stack, a comfortable line height and a readable measure; code, endpoints and timers use monospace where appropriate.

Keep English, Brazilian Portuguese and Spanish catalogs key-identical. Labels name their action. Empty model selection points to provider setup. Configuration is not a successful connection; changed configuration is not confirmed saved until persistence succeeds. General preferences show saving/saved feedback only around their confirmed save operation.

Keep technical MCP, memory and model tuning progressively disclosed. Preserve the existing controls and API contracts. Settings components render inside the workspace rather than a fixed full-window overlay.

## Floating surfaces

The recording bar stays in its independent native window; the Session panel remains movable/resizable. Both operate on the same active session. Native bounds and recording behavior are unchanged by visual work.

Use clear selected tabs, readable answer surfaces, distinct speaker bubbles and a separate question field. Fit controls at the native 420px minimum. Preserve drag/no-drag regions, keyboard resize semantics and recording state.

## Interaction and verification

Use the existing short transitions and reduced-motion behavior. Do not animate idle audio as recording. Retain focus, loading, error, disabled and confirmed-state feedback. Navigation focuses the new page and resets its scroll without stealing focus already taken inside it.

Visual changes are reviewed locally before shipping. Check the actual implementation at desktop and narrow widths, including translated labels. Route tests cover canonical destinations and legacy links; repository gates cover the renderer and backend. Native audio and installed-app replacement require their separate scope and authorization.

## Sources

`ui/src/features/shell/`, `ui/src/settings/`, `ui/src/components/brand.tsx`, `ui/src/features/overlay/`, `ui/src/index.css` and the owner-approved local boards under `~/Desktop/Previews/`.

## Reusable preference controls

The shared control foundation is documented in [Interface design system](docs/design-system.md). General preferences use compact `PreferenceField` groups with nearby controls and Radix `ChoiceTile` options. Spacing, radii, interaction durations and reduced-motion values come from `ui/src/styles/design-tokens.css`; semantic colors continue to come from the existing theme. New preference work should use these compositions rather than adding full-width label/control rows.
