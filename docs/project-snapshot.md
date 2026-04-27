# Project Snapshot

Snapshot date: 2026-04-26

## Goal

Build a small macOS desktop app for YouTube Music that gives `music.youtube.com` its own native shell while keeping search, queueing, playback, account state, and library behavior handled by YouTube Music itself.

The app should eventually provide:

- A dedicated app window, Dock icon, and Cmd+Tab slot.
- Persistent login/session cookies.
- Native app name and icon.
- Basic macOS menu actions.
- Media key support if the embedded page exposes usable controls.
- Optional mini-player, always-on-top mode, and menu bar controller.

## Current Branch

Branch: `phase-3-media-keys`

Latest merged implementation commit before this phase:

```text
fa1c520 Add native shell controls (#2)
```

## Work Completed

Phase 1 compatibility spike has been implemented and merged.

Added:

- Electron + TypeScript scaffold.
- Bun lockfile and development scripts.
- Main Electron window that loads `https://music.youtube.com/`.
- Persistent Electron session partition: `persist:youtube-music`.
- Secure renderer defaults:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
- Basic single-instance behavior.
- Window size and position persistence.
- Navigation policy that keeps YouTube/Google flows in-app and opens unrelated links externally.
- Native menu actions for:
  - Back
  - Forward
  - Reload
  - Copy current URL
  - Open current URL in browser
  - Toggle DevTools
  - Full screen
- macOS packaging config through `electron-builder`.
- Compatibility checklist in `docs/compatibility-spike.md`.
- Expanded README with setup and verification commands.

Phase 2 native-shell work has been implemented and merged.

Added:

- Custom app icon source and PNG packaging asset.
- More complete native app menus:
  - File/share/current URL actions.
  - Edit speech and paste-match-style actions.
  - Navigation home/reload actions.
  - View zoom, fullscreen, DevTools, always-on-top, mini-player, and reset-size actions.
- Native macOS share sheet for the current YouTube Music page.
- Always-on-top toggle.
- Mini-player window mode.
- Separate persisted window bounds for standard and mini-player modes.
- Restore of always-on-top, maximized, fullscreen, standard bounds, and mini bounds.
- Atomic window-state writes.
- Narrower Google in-app navigation allowlist for known sign-in/account/support/payment flows while keeping YouTube hosts in-app.

Phase 3 media-key work is now in progress.

Added:

- Playback menu actions for:
  - Play/Pause
  - Next Track
  - Previous Track
- Global hardware media-key registration for:
  - `MediaPlayPause`
  - `MediaNextTrack`
  - `MediaPreviousTrack`
- Cleanup of registered media shortcuts on quit.
- Windows/Linux `app-command` handling for equivalent media commands.
- Scoped YouTube Music control dispatch that only runs on `music.youtube.com`.
- Play/pause first attempts the page media element, then falls back to enabled YouTube Music player controls.
- Next/previous use enabled YouTube Music player controls by label or scoped player-bar selectors.
- Console diagnostics if media-key registration fails because another app owns the shortcut or macOS Accessibility permission is needed.

## Verification Completed

The following checks passed locally:

```sh
bun run typecheck
bun run build
bun run package:mac
git diff --cached --check
```

Packaging produced a local macOS app, DMG, and zip under the ignored `release/` directory.

Note: the first package attempt failed because the sandbox could not resolve `github.com` while `electron-builder` was downloading Electron. After network approval, packaging completed successfully.

For the Phase 2 native-shell slice, the following checks passed locally:

```sh
bun run typecheck
bun run build
bun run package:mac
git diff --check
```

Packaging produced a macOS app bundle with `CFBundleIconFile` set to `icon.icns`, generated from `build/icon.png`.

For the Phase 3 media-key slice, the following checks passed locally:

```sh
bun run typecheck
bun run build
bun run package:mac
```

## Manual Compatibility Checks Still Needed

Run:

```sh
bun run dev
```

Then verify with a real YouTube Music account:

- App opens `https://music.youtube.com` in its own window.
- Google sign-in completes without a `disallowed_useragent` or related block.
- Signed-in session persists after quitting and reopening.
- Search works.
- Playback works.
- Play/pause, next, previous, and queueing work through the site UI.
- Library navigation works.
- Account menu works.
- External non-Google/non-YouTube links open in the system browser.
- Share Current Page opens the native macOS share sheet.
- Always on Top keeps the app above other windows and persists after reopening.
- Mini Player switches to compact bounds and restores separately from the standard window size.
- Reset Window Size returns the current mode to its default bounds.
- Playback menu Play/Pause controls the current YouTube Music player.
- Playback menu Next Track advances the queue.
- Playback menu Previous Track goes back in the queue.
- Keyboard media keys trigger play/pause, next track, and previous track while the app is running.
- If media keys do not respond, confirm whether another app owns the keys or macOS Accessibility permission is required.

## PR Status

Phase 1 PR #1 and Phase 2 PR #2 were merged into `main`.

The active Phase 3 branch is `phase-3-media-keys`.

## Planned Phases

### Phase 1: Compatibility Spike

Status: implemented and merged, pending manual login/playback validation.

Purpose: prove that YouTube Music works reliably inside Electron before investing in native app polish.

Pivot rule: if Google sign-in is blocked or flaky in Electron, stop Electron-specific work and switch to a packaged Chrome PWA or launcher that uses the real Chrome browser profile.

### Phase 2: Native Shell

Status: implemented and merged.

Add:

- Custom app icon. `Implemented`
- More complete macOS menu. `Implemented`
- Share current song/page action. `Implemented for current page`
- Always-on-top toggle. `Implemented`
- Mini-player window mode. `Implemented`
- Stronger window/session restore polish. `Implemented`
- Better external-link allowlist after observing real login and account flows. `Partially implemented; still needs validation against real login/account flows`

### Phase 3: Player Polish

Status: in progress.

Add:

- Media key support. `Implemented, pending real hardware validation`
- Optional global shortcuts:
  - Play/pause. `Implemented for hardware media key`
  - Next. `Implemented for hardware media key`
  - Previous. `Implemented for hardware media key`
  - Search/focus
- Optional menu bar/tray controller.
- Current track detection only if reliable metadata is available without brittle scraping.
- Native notifications only if metadata proves stable.

### Phase 4: Packaging

Add:

- Final app icon assets.
- Polished `.app` and `.dmg` metadata.
- Signing and notarization if the app is distributed beyond local personal use.
- Release documentation.

## Next Recommended Step

Run the manual compatibility checks with the Phase 3 media-key controls. If login, playback, menu playback controls, hardware media keys, sharing, always-on-top, mini-player, and state restore work cleanly, continue to a small Phase 3 follow-up for search/focus or menu bar control. Do not add current-track detection, notifications, or rich player metadata until the page exposes stable metadata without brittle scraping.
