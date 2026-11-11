# Packaged hardware and capture checks

The branded review application was exercised on 2026-10-22 using its actual packaged executable and native helpers, an isolated Chromium/app profile, cached verified Whisper tiny/Qwen3 0.6B models and no credentials. The existing user application was preserved. [Sanitized results](packaged-hardware-verification.json) retain metrics and controlled-phrase assertions, not raw transcripts or user-device identifiers.

## Passed local checks

- The running application's AppKit icon contains the approved conversation mark. Activation policy is regular. The actual Dock icon was not clicked.
- The packaged app reports granted microphone and screen permissions, and its system-audio helper reports supported/granted. Permission status does not establish successful microphone capture.
- A separate `afplay` process played locally generated speech. The production native system-audio helper delivered real output PCM through renderer IPC into the production progressive Whisper service. The final transcript exactly matched the 3.5-second controlled phrase, one draft and one final caption were observed, and real local Qwen answered the day and owner correctly. The normal combined microphone/listening UI was not used for this incoming-only check.
- Direct desktop-independent ScreenCaptureKit window captures returned zero non-transparent pixels for the protected workspace, overlay and Notch. Disabling protection in the isolated profile returned visible content in each matching control capture. The final probe had the workspace and Notch on screen; the overlay remained capturable in its off-screen control. Protection was restored afterward.
- Native audio, local model servers and the diagnostic application were stopped; its session was ended. The normal application remained running.

The first exploratory probe sent independent two-second chunks to file transcription and produced a wrong owner in a follow-up. That probe did not reproduce progressive meeting buffering. The subsequent progressive path passed its exact controlled phrase and fact checks. Neither result establishes arbitrary-speech accuracy or long-meeting behavior.

## Still pending

AirPods were absent from the actual input-device inventory. No microphone capture was attempted while waiting for a deliberate human-speech sample. Connect AirPods, confirm they appear in Electron and then capture a bounded sample through the normal listening UI. Microphone and system audio together still require a real meeting test.

Teams attendee-view exclusion and whole-display sharing remain untested. This pass exercised one ScreenCaptureKit single-window API on this Mac. Other capture implementations and versions can behave differently; see [Electron's documented limitation](https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows).

Optional cloud Realtime and dedicated email are not exercised by this local pass. No keys were configured, no external account was contacted and no email was sent.

## Reproduce the capture probe

The helper only accepts an application with bundle ID `dev.danieldias.learntranscriber`. Captures may contain session content: use an isolated profile with controlled test data and keep output ignored/private. It creates output directories with owner-only permissions. It changes no protection settings; compare captures before and after toggling protection explicitly in the diagnostic instance and restore it afterward.

```sh
xcrun swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors \
  -parse-as-library scripts/capture-content-probe.swift \
  -o .local/capture-content-probe
.local/capture-content-probe <diagnostic-app-pid> .local/capture-output
```

The JSON includes actual pixel dimensions and non-transparent pixel counts. A count of `-1` means the bitmap format could not be measured; it is not a passing transparent capture. The script compiled with strict Swift 6 concurrency checking and ran successfully against both protected and unprotected controls. It is a diagnostic helper, not a new application feature.

- [Apple single-frame capture API](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager/captureimage(contentfilter:configuration:completionhandler:))
