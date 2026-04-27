# YouTube Music Wrapper

A small Electron desktop shell for [YouTube Music](https://music.youtube.com).

The app deliberately leaves search, queueing, playback, account state, and library behavior to YouTube Music itself. The native shell is responsible for giving the site its own desktop window, session storage, menu actions, menu bar controller, and future macOS app polish.

This is an unofficial wrapper and is not affiliated with Google or YouTube.

## Current Scope

This repo is in the native-shell and player-polish phase. The Electron compatibility spike is implemented; the current work adds macOS app polish around menus, window behavior, app identity, sharing, search focus, menu bar control, and compact playback controls while YouTube Music continues to own account state, search, queueing, and playback.

## Install

### Download a Release

When prebuilt releases are available, download the latest macOS `.dmg` from the GitHub Releases page, open it, and drag **YouTube Music Wrapper** into **Applications**.

If macOS blocks the app because the release is not signed or notarized yet, right-click the app in **Applications**, choose **Open**, then confirm that you want to open it.

### Build and Install Locally

If there is not a prebuilt release for your Mac, build the app from source:

```sh
bun install
bun run package:mac
```

The packaged app, DMG, and zip are written to `release/`. Open the generated `.dmg` and drag **YouTube Music Wrapper** into **Applications**.

## Development

Use development mode only when working on the app itself:

```sh
bun install
bun run dev
```

Useful commands:

```sh
bun run typecheck
bun run build
bun run package:mac
```

## Releases

Pull requests run the GitHub Actions PR checks, and tagged releases can publish the generated macOS `.dmg` and `.zip` artifacts. See [docs/release.md](docs/release.md).

## Native Shell Features

- Dedicated Electron window for `https://music.youtube.com/`.
- Persistent YouTube Music session partition.
- Native macOS menu actions for navigation, search focus, sharing, URL copying, zoom, fullscreen, DevTools, always-on-top, and mini-player mode.
- Menu bar controller for show/hide, home, search focus, playback, mini-player, always-on-top, and quit actions.
- Playback menu actions and hardware media-key handlers for play/pause, next track, and previous track.
- Window state restore with separate standard and mini-player bounds.
- Custom app icon for development and packaging.

## Compatibility Checklist

See [docs/compatibility-spike.md](docs/compatibility-spike.md).
