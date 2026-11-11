# Interface design system

The renderer uses the existing shadcn/Radix controls, Geist type, graphite surfaces and blue accent. This foundation standardizes the current preferences and repeated interaction patterns; migrating other screens is separate work.

## Sources of truth

- `ui/src/index.css`: semantic theme colors (`background`, `foreground`, `card`, `muted-foreground`, `primary`, `border`, `ring`).
- `ui/src/styles/design-tokens.css`: shared spacing, control dimensions, typography sizes, corner radii and motion.
- `ui/src/components/ui/`: reusable controls and compositions.
- `ui/src/settings/tabs/profile/interface-preferences.css`: layout and miniature appearance previews specific to General preferences.

The workspace and floating assistant retain their existing independent theme behavior. The appearance picker changes `surfaceTheme`; it does not change the workspace theme.

## Tokens

| Intent | Token | Value |
| --- | --- | --- |
| Tight spacing | `--ui-space-1`, `--ui-space-2` | 4px, 8px |
| Related controls | `--ui-space-3`, `--ui-space-4` | 12px, 16px |
| Section spacing | `--ui-space-6` | 24px |
| Control / panel corners | `--ui-radius-control`, `--ui-radius-panel` | 10px, 16px |
| Preference control height | `--ui-control-height` | 40px minimum |
| Label / supporting copy | `--ui-text-label`, `--ui-text-caption` | 14px, 12px |
| Feedback / layout duration | `--ui-motion-fast`, `--ui-motion-standard` | 160ms, 220ms |
| Motion curve | `--ui-ease-out` | cubic-bezier(0.22, 1, 0.36, 1) |
| Hover / press feedback | `--ui-hover-lift`, `--ui-press-scale` | -2px, 0.97 |
| Preference surface / edge | `--ui-setting-surface`, `--ui-setting-border` | existing card / border colors |
| Selected option | `--ui-selected-surface` | 8% primary mixed with card |

Reduced motion sets durations to zero, hover lift to zero and press scale to one. Hover transforms require a precise pointer; disabled controls never animate. The existing global reduced-motion override also remains in force.

## Components

### PreferenceField

Groups one preference's icon, heading, description and control. Required props: `id`, `title`, `description`, `icon`, `children`. It generates `${id}-label` and `${id}-description`; associate the child control with those IDs. Supply translated copy at the feature boundary. Decorative icons are excluded from the accessible name.

Use the composition when a small setting benefits from a recognizable icon and a nearby control. Do not stretch two options across an entire page. General uses a two-column grid capped at 760px with equal-height fields and bottom-aligned controls; below 700px the fields stack.

```tsx
<PreferenceField id="language" icon={<Languages />} title={label} description={description}>
  <SelectTrigger aria-labelledby="language-label" aria-describedby="language-description">
    <SelectValue />
  </SelectTrigger>
</PreferenceField>
```

The trigger must remain inside a controlled `Select` with its option list.

### ChoiceTile

A styled Radix `RadioGroup.Item`, with required `value` and translated `label`, optional `icon` and decorative preview children. Place inside a controlled `RadioGroup.Root`. Its label remains accessible even when a preview is present; checked state comes from Radix, not local visual state. Radix owns keyboard selection and the indicator. Native disabled and focus props are preserved.

Use for a small set of exclusive visual choices. Do not use it for navigation, commands or independent toggles. Theme thumbnails represent the floating surface, while persistence remains the responsibility of `InterfacePreferences`.

### SuggestionChip

A command button with a wrapping label and decorative arrow, built on the existing shadcn `Button`. Use `title` for the full prompt, `children` for the short label, `disabled` while a request is active and `onClick` for the existing selection action. It always has `type="button"`, so suggestions never accidentally submit an enclosing form.

Session follow-ups, floating panel follow-ups and expanded floating insight follow-ups all use this component. Text, prompts and generation remain with the caller; shared appearance and motion live in `suggestion-chip.css`. The chip follows the current surface's semantic colors, including floating light mode.

### SelectionTrack and SegmentedTabsList

`SelectionTrack` follows a selected audio button using measured position and dimensions, including wrapping onto another row in narrow windows. Buttons and audio callbacks remain owned by the feature.

`SegmentedTabsList` belongs inside a controlled Radix `Tabs` root. Use it for AI views and provider filters; Radix owns arrow-key navigation, selection and panel relationships. The indicator observes individual labels and its container, and releases its observer and pending frame on cleanup. Keep the corresponding route updates in the caller.

### ActionButton

Use `ActionButton` for primary text commands such as creating, saving, connecting or reviewing. It composes Button and preserves native type, ref, disabled, aria-busy and event props. Callers own validation, pending state and the operation itself. Optional `icon` is decorative; optional `tone="contrast"` keeps Home readable over its animated background.

A leading mark fills the pill on precise-pointer hover or keyboard focus, the single label shifts slightly and a trailing arrow appears. Disabled or busy actions do not animate; reduced motion removes transitions. Long labels wrap without horizontal overflow. Secondary, destructive, icon-only, selection and live recording controls remain on the existing Button or specialized primitive.

### Existing controls

Keep `Button` for commands, `Select` for longer option lists, and `SuggestionChip` for generated question shortcuts. Assistant cards, follow-up chips and workspace navigation now consume the shared motion tokens. Preserve each surface's existing geometry and behavior when adopting tokens.

## States and validation

Show selection through border, background and checkmark together. Retain a visible keyboard focus ring, disabled cursor/opacity, pending save lock and confirmed save status. A saved status only appears after the settings bridge resolves successfully. Do not show success for a rejected save.

Tests in `ui/test/preference-controls.test.cjs` and `ui/test/suggestion-chip.test.cjs` pin label/description relationships, translated radio names and native prop forwarding. Browser checks cover actual keyboard selection, persistence, disabled controls, reduced motion and narrow layouts.

## References

- [shadcn theming](https://ui.shadcn.com/docs/theming): semantic CSS variables and existing theme tokens.
- [shadcn Select](https://ui.shadcn.com/docs/components/select): the existing project control.
- [Radix Radio Group](https://www.radix-ui.com/primitives/docs/components/radio-group): exclusive selection and keyboard behavior.

The doubled root selectors on `PreferenceField` and `ChoiceTile` intentionally outrank the existing `.settings-scope :where(...)` browser-default resets. Keep this boundary in the shared component stylesheet; feature styles should not add competing resets.

## Compact navigation and settings rhythm

Workspace primary links compose the installed Radix `NavigationMenu` primitive with the existing shadcn `Button`. Below 960px the four actual destinations occupy a compact four-column tray. Labels remain on one line with their full text available through the accessible link name and title. Radix handles arrow-key navigation; existing hash routes and page focus remain in place. The desktop rail retains its hover expansion.

Embedded settings use a 1120px content limit, while related General preference and audio controls share a 760px width. Section gaps, tab spacing, save feedback and profile-card padding use shared spacing tokens. Preserve denser grids for providers and shortcuts; do not force all pages into the narrower General width.

## Additional adopters

`PreferenceField` now groups the session-notes folder controls, capture-display picker and local performance presets. `ChoiceTile` represents the capture display and Safe/Balanced/Fast presets. Specialized actions, independent switches and permission grants keep their existing controls; see [the adoption assessment](reviews/shared-controls-adoption.md) for the researched mapping and scope.
