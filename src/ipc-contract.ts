// IPC contract shared by main and renderer (preload) sides.
//
// Channels are namespaced under `ymw:` (YouTube Music Wrapper) to avoid
// colliding with anything Electron or the page itself might use in the
// future. Values flowing across the bridge are validated at runtime on the
// main-process side; never trust raw return values.

export const IpcChannel = {
  PageActionMediaControl: "ymw:page-action:media-control",
  PageActionFocusSearch: "ymw:page-action:focus-search"
} as const;

export type MediaControlAction = "playPause" | "nextTrack" | "previousTrack";

export type PageActionResult = {
  handled: boolean;
  method?: string;
  reason?: string;
};

export function isPageActionResult(value: unknown): value is PageActionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.handled !== "boolean") {
    return false;
  }

  if (typeof candidate.method !== "undefined" && typeof candidate.method !== "string") {
    return false;
  }

  if (typeof candidate.reason !== "undefined" && typeof candidate.reason !== "string") {
    return false;
  }

  return true;
}

export function isMediaControlAction(value: unknown): value is MediaControlAction {
  return value === "playPause" || value === "nextTrack" || value === "previousTrack";
}
