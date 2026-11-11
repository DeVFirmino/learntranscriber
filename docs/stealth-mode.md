# Stealth mode

Presentation privacy now has a single **Enable stealth mode** switch. It forces native capture protection, hides the Dock/app-switcher entry and clears native window titles across the workspace and floating assistant. Existing individual capture/Dock preferences are preserved and take effect again when stealth is disabled. Stealth is opt-in; existing profiles migrate with it off. No dependency was added.

The controller applies protection before presentation and reasserts it on show, focus, restore and renderer page-title changes. Newly created windows inherit the current mode. Emergency concealment remains authoritative: settings changes cannot reveal concealed windows, and restoration reveals only windows that were previously visible. Stealth is independent of audio recording; use Stop listening to end meeting capture.

**Show menu bar icon** provides a separate preference. Hiding the icon requires a registered restore shortcut (Command–B by default); if it is unavailable or claimed by another saved shortcut, the icon remains and the UI explains the recovery fallback. Re-enabling the icon recreates its native tray/menu. The setting is persisted with the other preferences.

## Verification

- 69 backend tests and 22 UI tests pass. New backend cases cover forced effective state without preference loss, title/focus/restore guards, late windows during concealment and menu-icon recovery. Existing persistence coverage now verifies the new preferences survive reopening SQLite.
- 115 normal Electron development checks pass. An optional Orca probe adds one check: `LEARNTRANSCRIBER_ORCA_WINDOW_PROBE=1 npm run smoke` passes 116 on this Mac. It confirms protected visible app windows are absent from Orca's visible-window listing. Orca is a verification tool only, not an app dependency.
- Native checks exercise the real UI switch/preload, capture flags, native empty titles, Dock hide/restore, title-change protection, inherited window state, recovery fallback and restoration of individual preferences.
- The independent macOS metadata probe reports `kCGWindowSharingState = 0` for all three selected protected BrowserWindows. It reads window metadata for the explicitly selected process only, without capturing pixels. Off-screen Electron internal windows are not asserted to be protected application surfaces.
- TypeScript/Vite build, JavaScript syntax and lint pass with the existing bundle-size advisory and six pre-existing lint warnings. Browser review at 1280, 390 and 320 pixels found no horizontal overflow or functional text below 11px. The design detector found no issues. See [native evidence](stealth-native-verification.json).

These observations establish local flags, window-discovery exclusion and lifecycle behavior. They do **not** establish invisibility in a real Teams/Zoom/Meet session or against every screen-capture API. No meeting, user recording or account setting was changed. The existing user app process was left running; the native tests use an isolated development profile. The packaged app has not been replaced pending review of the new UI.

## Official platform references

- [Electron content protection](https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows): on macOS this requests `NSWindowSharingNone`; ScreenCaptureKit capture can still include the window.
- [Electron activation policy](https://www.electronjs.org/docs/latest/api/app#appsetactivationpolicypolicy-macos): accessory applications omit the Dock entry while retaining interactive windows.
- [Electron title-change event](https://www.electronjs.org/docs/latest/api/browser-window#event-page-title-updated): preventing the default blocks document-title updates to the native title.


## Direct capture checkpoint — 2026-10-22

The branded packaged review build now has a direct ScreenCaptureKit single-window comparison: protected workspace, overlay and Notch return transparent pixels while matching unprotected control captures contain visible content. This is narrower than whole-display sharing or a Teams attendee-view test, which remain pending. See [the packaged check and its boundaries](packaged-hardware-check.md).
