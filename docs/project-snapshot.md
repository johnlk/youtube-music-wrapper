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

Branch: `phase-1-electron-spike`

Latest implementation commit before this snapshot:

```text
5695aeb Add Electron YouTube Music compatibility spike
```

## Work Completed

Phase 1 compatibility spike has been implemented.

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

## PR Status

The branch was pushed to GitHub:

```text
origin/phase-1-electron-spike
```

PR creation was attempted but blocked because the local GitHub CLI token is invalid:

```text
The token in default is invalid.
To re-authenticate, run: gh auth login -h github.com
```

PR creation URL:

```text
https://github.com/johnlk/youtube-music-wrapper/pull/new/phase-1-electron-spike
```

## Planned Phases

### Phase 1: Compatibility Spike

Status: implemented, pending manual login/playback validation.

Purpose: prove that YouTube Music works reliably inside Electron before investing in native app polish.

Pivot rule: if Google sign-in is blocked or flaky in Electron, stop Electron-specific work and switch to a packaged Chrome PWA or launcher that uses the real Chrome browser profile.

### Phase 2: Native Shell

Add:

- Custom app icon.
- More complete macOS menu.
- Share current song/page action.
- Always-on-top toggle.
- Mini-player window mode.
- Stronger window/session restore polish.
- Better external-link allowlist after observing real login and account flows.

### Phase 3: Player Polish

Add:

- Media key support.
- Optional global shortcuts:
  - Play/pause
  - Next
  - Previous
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

Run the manual compatibility checks. If login and playback work cleanly, continue to Phase 2 on top of the Electron implementation. If login fails because of embedded browser restrictions, pivot before adding media keys or mini-player features.
