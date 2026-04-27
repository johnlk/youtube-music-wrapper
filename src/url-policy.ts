// Single source of truth for URL policy.
//
// `IN_APP_HOSTS` is the allow-list for hosts that may load inside the wrapper
// window (used by `will-navigate` and `setWindowOpenHandler`). Anything else is
// routed to the user's default browser via `shell.openExternal`.
//
// `MUSIC_HOST` is the only host where in-page actions (media controls,
// focus-search, keyboard shortcut fallbacks) are permitted. We deliberately
// keep this narrower than the navigation allow-list: a user signing in via
// accounts.google.com should not have the wrapper trying to click YT Music
// buttons against the Google sign-in DOM.

export const MUSIC_HOST = "music.youtube.com";

// Hosts permitted to load inside the wrapper window. Kept minimal: the YT
// Music app, the consent flow, and the Google account sign-in surfaces that
// the YT Music auth flow actually redirects through.
const IN_APP_HOSTS: ReadonlySet<string> = new Set([
  MUSIC_HOST,
  "consent.youtube.com",
  "consent.google.com",
  "accounts.google.com",
  "accounts.youtube.com",
  "myaccount.google.com",
  "policies.google.com"
]);

export function shouldLoadInApp(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  return IN_APP_HOSTS.has(url.hostname.toLowerCase());
}

export function isMusicHost(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);

  if (!url) {
    return false;
  }

  return url.hostname.toLowerCase() === MUSIC_HOST;
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}
