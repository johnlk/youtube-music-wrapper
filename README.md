# YouTube Music Wrapper

A small Electron desktop shell for [YouTube Music](https://music.youtube.com).

The app deliberately leaves search, queueing, playback, account state, and library behavior to YouTube Music itself. The native shell is responsible for giving the site its own desktop window, session storage, menu actions, and future macOS app polish.

## Current Scope

This repo is in the native-shell phase. The Electron compatibility spike is implemented; the current work adds macOS app polish around menus, window behavior, app identity, sharing, and compact playback controls while YouTube Music continues to own account state, search, queueing, and playback.

## Development

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

## Native Shell Features

- Dedicated Electron window for `https://music.youtube.com/`.
- Persistent YouTube Music session partition.
- Native macOS menu actions for navigation, sharing, URL copying, zoom, fullscreen, DevTools, always-on-top, and mini-player mode.
- Playback menu actions and hardware media-key handlers for play/pause, next track, and previous track.
- Window state restore with separate standard and mini-player bounds.
- Custom app icon for development and packaging.

## Compatibility Checklist

See [docs/compatibility-spike.md](docs/compatibility-spike.md).
