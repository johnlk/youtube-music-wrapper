// Runs in the isolated world for the YT Music page. With `contextIsolation:
// true`, this script and the page's own scripts share a DOM but have separate
// JS contexts; we are not exposing any privileged API to the page via
// `contextBridge`. The preload registers IPC listeners that operate on the
// page's DOM and respond to the main process.

import { ipcRenderer, type IpcRendererEvent } from "electron";

type PageActionResult = {
  handled: boolean;
  method?: string;
  reason?: string;
};

type MediaControlAction = "playPause" | "nextTrack" | "previousTrack";

type IpcRequest = {
  id: number;
  action: string;
  payload?: unknown;
};

const REQUEST_CHANNEL = "ymw:request";
const RESPONSE_CHANNEL_PREFIX = "ymw:response:";

ipcRenderer.on(REQUEST_CHANNEL, async (_event: IpcRendererEvent, request: IpcRequest) => {
  const { id, action, payload } = request ?? {};

  if (typeof id !== "number" || typeof action !== "string") {
    return;
  }

  let result: PageActionResult;

  try {
    result = await dispatch(action, payload);
  } catch (error) {
    result = { handled: false, reason: errorMessage(error) };
  }

  ipcRenderer.send(`${RESPONSE_CHANNEL_PREFIX}${id}`, result);
});

async function dispatch(action: string, payload: unknown): Promise<PageActionResult> {
  if (action === "media-control") {
    if (!isMediaControlAction(payload)) {
      return { handled: false, reason: "invalid media control action" };
    }
    return performMediaControl(payload);
  }

  if (action === "focus-search") {
    return performFocusSearch();
  }

  return { handled: false, reason: `unknown action: ${action}` };
}

function isMediaControlAction(value: unknown): value is MediaControlAction {
  return value === "playPause" || value === "nextTrack" || value === "previousTrack";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Shared DOM helpers
// ---------------------------------------------------------------------------

function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function isElementDisabled(element: Element): boolean {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute("aria-disabled") === "true" ||
    element.hasAttribute("disabled")
  );
}

function queryAllAcrossShadow(selectors: readonly string[]): Element[] {
  const matches: Element[] = [];
  const visitedRoots = new Set<DocumentFragment | Document>();

  const visit = (root: DocumentFragment | Document | null | undefined) => {
    if (!root || visitedRoots.has(root)) {
      return;
    }
    visitedRoots.add(root);

    for (const selector of selectors) {
      matches.push(...Array.from(root.querySelectorAll(selector)));
    }

    for (const element of Array.from(root.querySelectorAll("*"))) {
      if ((element as Element & { shadowRoot?: ShadowRoot }).shadowRoot) {
        visit((element as Element & { shadowRoot?: ShadowRoot }).shadowRoot ?? null);
      }
    }
  };

  visit(document);
  return matches;
}

// ---------------------------------------------------------------------------
// Media controls
// ---------------------------------------------------------------------------

const MEDIA_CONTROL_CONFIG: Record<MediaControlAction, { labels: string[]; selectors: string[] }> = {
  playPause: {
    labels: ["play", "pause"],
    selectors: [
      "ytmusic-player-bar #play-pause-button",
      "ytmusic-player-bar .play-pause-button",
      "#play-pause-button"
    ]
  },
  nextTrack: {
    labels: ["next", "next song", "next track"],
    selectors: [
      "ytmusic-player-bar .next-button",
      "ytmusic-player-bar [aria-label='Next']",
      ".next-button"
    ]
  },
  previousTrack: {
    labels: ["previous", "previous song", "previous track"],
    selectors: [
      "ytmusic-player-bar .previous-button",
      "ytmusic-player-bar [aria-label='Previous']",
      ".previous-button"
    ]
  }
};

async function performMediaControl(action: MediaControlAction): Promise<PageActionResult> {
  const config = MEDIA_CONTROL_CONFIG[action];

  if (!config) {
    return { handled: false, reason: "unknown action" };
  }

  // 1) Try the underlying media element (only meaningful for play/pause).
  if (action === "playPause") {
    const mediaResult = await tryMediaElementToggle();
    if (mediaResult.handled) {
      return mediaResult;
    }
  }

  // 2) Selector-based hits.
  const selectorResult = clickFirstMatch(config.selectors, "selector");
  if (selectorResult.handled) {
    return selectorResult;
  }

  // 3) Localized aria-label / title hits.
  const labelResult = clickByLocalizedLabel(config.labels);
  if (labelResult.handled) {
    return labelResult;
  }

  return { handled: false, reason: "no enabled YouTube Music control found" };
}

async function tryMediaElementToggle(): Promise<PageActionResult> {
  const candidates = Array.from(document.querySelectorAll("video, audio")) as Array<
    HTMLMediaElement
  >;
  const media = candidates.find((element) => element.readyState > 0 || !element.paused);

  if (!media) {
    return { handled: false };
  }

  try {
    if (media.paused) {
      await media.play();
    } else {
      media.pause();
    }
    return { handled: true, method: "media-element" };
  } catch (error) {
    return { handled: false, reason: errorMessage(error) };
  }
}

function clickFirstMatch(selectors: readonly string[], methodPrefix: string): PageActionResult {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element || !isElementVisible(element) || isElementDisabled(element)) {
      continue;
    }

    (element as HTMLElement).click();
    return { handled: true, method: `${methodPrefix}:${selector}` };
  }

  return { handled: false };
}

function clickByLocalizedLabel(expectedLabels: readonly string[]): PageActionResult {
  const candidates = Array.from(
    document.querySelectorAll("button, tp-yt-paper-icon-button, yt-icon-button")
  );

  for (const element of candidates) {
    const label = [element.getAttribute("aria-label"), element.getAttribute("title")]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();

    const matchesLabel = expectedLabels.some(
      (expected) =>
        label === expected ||
        label.startsWith(`${expected} `) ||
        label.includes(` ${expected}`)
    );

    if (!matchesLabel) {
      continue;
    }

    if (!isElementVisible(element) || isElementDisabled(element)) {
      continue;
    }

    (element as HTMLElement).click();
    return { handled: true, method: `label:${label}` };
  }

  return { handled: false };
}

// ---------------------------------------------------------------------------
// Search focus
// ---------------------------------------------------------------------------

const SEARCH_INPUT_SELECTORS = [
  "ytmusic-search-box input#input",
  "ytmusic-search-box input",
  "input[aria-label='Search']",
  "input[aria-label*='Search' i]",
  "input[placeholder='Search']",
  "input[placeholder*='Search' i]",
  "input[type='search']"
];

const SEARCH_CONTROL_SELECTORS = [
  "ytmusic-search-box tp-yt-paper-icon-button",
  "ytmusic-search-box button",
  "a[href^='/search']",
  "a[aria-label='Search']",
  "a[aria-label*='Search' i]",
  "button[aria-label='Search']",
  "button[aria-label*='Search' i]",
  "yt-icon-button[aria-label='Search']",
  "yt-icon-button[aria-label*='Search' i]",
  "tp-yt-paper-icon-button[aria-label='Search']",
  "tp-yt-paper-icon-button[aria-label*='Search' i]",
  "[role='button'][aria-label='Search']",
  "[role='button'][aria-label*='Search' i]"
];

async function performFocusSearch(): Promise<PageActionResult> {
  const existing = focusFirstAvailableInput();
  if (existing.handled) {
    return existing;
  }

  const clicked = clickAnySearchControl();
  if (clicked.handled) {
    const inputResult = await waitForFocusableInput(1000);
    if (inputResult.handled) {
      return {
        handled: true,
        method: `${clicked.method ?? "search-control"} -> ${inputResult.method ?? "input"}`
      };
    }
  }

  return { handled: false, reason: "no enabled YouTube Music search field found" };
}

function focusFirstAvailableInput(): PageActionResult {
  for (const element of queryAllAcrossShadow(SEARCH_INPUT_SELECTORS)) {
    if (!isElementVisible(element) || isElementDisabled(element)) {
      continue;
    }

    const input = element as HTMLInputElement;
    input.focus();

    if (typeof input.select === "function") {
      try {
        input.select();
      } catch {
        // Some inputs don't accept select(); ignore.
      }
    }

    if (document.activeElement === input || input.matches(":focus")) {
      return { handled: true, method: "input" };
    }
  }

  return { handled: false };
}

function clickAnySearchControl(): PageActionResult {
  for (const element of queryAllAcrossShadow(SEARCH_CONTROL_SELECTORS)) {
    if (!isElementVisible(element) || isElementDisabled(element)) {
      continue;
    }

    (element as HTMLElement).click();
    return { handled: true, method: "search-control" };
  }

  return { handled: false };
}

function waitForFocusableInput(timeoutMs: number): Promise<PageActionResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const tick = () => {
      const result = focusFirstAvailableInput();
      if (result.handled) {
        resolve(result);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        resolve({ handled: false });
        return;
      }

      window.setTimeout(tick, 50);
    };

    tick();
  });
}
