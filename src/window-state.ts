import { app, BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

export type WindowMode = "standard" | "mini";

export type SavedWindowState = {
  windowMode: WindowMode;
  standardBounds?: Rectangle;
  miniBounds?: Rectangle;
  isMaximized: boolean;
  isFullScreen: boolean;
  isAlwaysOnTop: boolean;
};

const STANDARD_WINDOW_MINIMUM = { width: 960, height: 640 };
const MINI_WINDOW_MINIMUM = { width: 380, height: 520 };
const STANDARD_WINDOW_DEFAULT = { width: 1280, height: 900 };
const MINI_WINDOW_DEFAULT = { width: 430, height: 660 };
const STATE_WRITE_DELAY_MS = 250;
// Sanity bound: anything larger than this is almost certainly corrupt or
// hostile state. Window managers cap at far less, but this keeps the JSON
// parser from passing absurd values into Electron's bounds APIs.
const MAX_BOUND_DIMENSION = 32768;
const MAX_BOUND_COORDINATE = 100000;

function statePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

export function readWindowState(): SavedWindowState {
  try {
    const rawState = fs.readFileSync(statePath(), "utf8");
    const parsedState = JSON.parse(rawState) as Partial<SavedWindowState> & { bounds?: Rectangle };
    const legacyBounds = coerceBounds(parsedState.bounds);

    return {
      windowMode: parsedState.windowMode === "mini" ? "mini" : "standard",
      standardBounds: coerceBounds(parsedState.standardBounds) ?? legacyBounds,
      miniBounds: coerceBounds(parsedState.miniBounds),
      isMaximized: Boolean(parsedState.isMaximized),
      isFullScreen: Boolean(parsedState.isFullScreen),
      isAlwaysOnTop: Boolean(parsedState.isAlwaysOnTop)
    };
  } catch {
    return getDefaultWindowState();
  }
}

export function getInitialWindowOptions(savedState = readWindowState()): BrowserWindowConstructorOptions {
  const mode = savedState.windowMode;
  const minimum = getMinimumSize(mode);

  return {
    ...getRestoredBounds(mode, savedState),
    minWidth: minimum.width,
    minHeight: minimum.height
  };
}

export function restoreWindowPresentation(window: BrowserWindow, state: SavedWindowState): void {
  window.setAlwaysOnTop(state.isAlwaysOnTop, "floating");

  if (state.windowMode === "standard" && state.isMaximized) {
    window.maximize();
  }

  if (state.windowMode === "standard" && state.isFullScreen) {
    window.setFullScreen(true);
  }
}

export function applyWindowMode(window: BrowserWindow, mode: WindowMode, state: SavedWindowState): void {
  const minimum = getMinimumSize(mode);

  if (window.isFullScreen()) {
    window.setFullScreen(false);
  }

  if (window.isMaximized()) {
    window.unmaximize();
  }

  window.setMinimumSize(minimum.width, minimum.height);
  window.setBounds(getRestoredBounds(mode, state));

  if (mode === "standard" && state.isMaximized) {
    window.maximize();
  }

  if (mode === "standard" && state.isFullScreen) {
    window.setFullScreen(true);
  }
}

export function captureWindowState(
  window: BrowserWindow,
  previousState: SavedWindowState,
  windowMode: WindowMode
): SavedWindowState {
  const bounds = coerceBounds(window.getNormalBounds());
  const nextState: SavedWindowState = {
    ...previousState,
    windowMode,
    isAlwaysOnTop: window.isAlwaysOnTop()
  };

  if (windowMode === "standard") {
    if (bounds) {
      nextState.standardBounds = bounds;
    }

    nextState.isMaximized = window.isMaximized();
    nextState.isFullScreen = window.isFullScreen();
  } else if (bounds) {
    nextState.miniBounds = bounds;
  }

  return nextState;
}

export function trackWindowState(window: BrowserWindow, persistState: () => void): void {
  let writeTimer: NodeJS.Timeout | null = null;

  const scheduleWrite = () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
    }

    writeTimer = setTimeout(() => {
      writeTimer = null;
      persistState();
    }, STATE_WRITE_DELAY_MS);
  };

  window.on("move", scheduleWrite);
  window.on("resize", scheduleWrite);
  window.on("maximize", scheduleWrite);
  window.on("unmaximize", scheduleWrite);
  window.on("enter-full-screen", scheduleWrite);
  window.on("leave-full-screen", scheduleWrite);
  window.on("always-on-top-changed", scheduleWrite);
  window.on("close", () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }

    persistState();
  });
}

let userDataDirEnsured = false;

export function writeWindowState(state: SavedWindowState): void {
  try {
    if (!userDataDirEnsured) {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      userDataDirEnsured = true;
    }

    const destinationPath = statePath();
    const tempPath = `${destinationPath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, destinationPath);
  } catch (error) {
    // Persisting window state is best-effort. We never want a disk full /
    // permission error to crash the main process — particularly during the
    // synchronous `close` path.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[window-state] Failed to persist window state: ${message}.`);
  }
}

function getDefaultWindowState(): SavedWindowState {
  return {
    windowMode: "standard",
    isMaximized: false,
    isFullScreen: false,
    isAlwaysOnTop: false
  };
}

function getMinimumSize(mode: WindowMode): { width: number; height: number } {
  return mode === "mini" ? MINI_WINDOW_MINIMUM : STANDARD_WINDOW_MINIMUM;
}

function getDefaultSize(mode: WindowMode): { width: number; height: number } {
  return mode === "mini" ? MINI_WINDOW_DEFAULT : STANDARD_WINDOW_DEFAULT;
}

function getRestoredBounds(mode: WindowMode, state: SavedWindowState): Rectangle {
  const savedBounds = mode === "mini" ? state.miniBounds : state.standardBounds;
  const minimum = getMinimumSize(mode);

  if (savedBounds && isVisibleOnAnyDisplay(savedBounds)) {
    return constrainBoundsToDisplay(savedBounds, minimum);
  }

  return getCenteredBounds(getDefaultSize(mode), minimum);
}

function getCenteredBounds(
  size: { width: number; height: number },
  minimum: { width: number; height: number }
): Rectangle {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.max(size.width, minimum.width), workArea.width);
  const height = Math.min(Math.max(size.height, minimum.height), workArea.height);

  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height
  };
}

function constrainBoundsToDisplay(bounds: Rectangle, minimum: { width: number; height: number }): Rectangle {
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(Math.max(bounds.width, minimum.width), workArea.width);
  const height = Math.min(Math.max(bounds.height, minimum.height), workArea.height);

  return {
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - height),
    width,
    height
  };
}

function coerceBounds(bounds: Partial<Rectangle> | undefined): Rectangle | undefined {
  if (
    bounds &&
    isFiniteNumber(bounds.x) &&
    isFiniteNumber(bounds.y) &&
    isFiniteNumber(bounds.width) &&
    isFiniteNumber(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.width <= MAX_BOUND_DIMENSION &&
    bounds.height <= MAX_BOUND_DIMENSION &&
    Math.abs(bounds.x) <= MAX_BOUND_COORDINATE &&
    Math.abs(bounds.y) <= MAX_BOUND_COORDINATE
  ) {
    return {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  }

  return undefined;
}

function isVisibleOnAnyDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const horizontallyVisible = bounds.x < area.x + area.width && bounds.x + bounds.width > area.x;
    const verticallyVisible = bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;

    return horizontallyVisible && verticallyVisible;
  });
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
