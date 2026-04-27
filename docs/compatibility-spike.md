# Compatibility Spike

The first milestone is to verify that YouTube Music works inside Electron before adding heavier native app polish.

## Run

```sh
bun install
bun run dev
```

## Manual Checks

- The app opens `https://music.youtube.com` in its own desktop window.
- Google sign-in completes without a `disallowed_useragent` or similar block.
- The signed-in session persists after quitting and reopening the app.
- Search, playback, queueing, library navigation, and account switching work.
- External non-Google/non-YouTube links open in the system browser.
- Back, forward, reload, and current URL menu actions work.
- Share Current Page opens the macOS share sheet.
- Always on Top toggles the main window above other windows.
- Mini Player toggles between compact and standard window bounds.
- Standard and mini-player window sizes restore after quitting and reopening.

## Pivot Criteria

If Google sign-in is blocked or unstable in the embedded Chromium context, stop investing in Electron-specific player polish. The fallback should be a packaged Chrome PWA or launcher that uses the real Chrome browser profile.
