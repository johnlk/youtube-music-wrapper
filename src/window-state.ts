import { app, BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

type SavedWindowState = {
  bounds: Rectangle;
  isMaximized: boolean;
};

const DEFAULT_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  width: 1280,
  height: 900
};

function statePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

export function getInitialWindowOptions(): BrowserWindowConstructorOptions {
  const savedState = readWindowState();

  if (!savedState || !isVisibleOnAnyDisplay(savedState.bounds)) {
    return DEFAULT_WINDOW_OPTIONS;
  }

  return savedState.bounds;
}

export function trackWindowState(window: BrowserWindow): void {
  window.once("ready-to-show", () => {
    const savedState = readWindowState();

    if (savedState?.isMaximized) {
      window.maximize();
    }
  });

  window.on("close", () => {
    writeWindowState({
      bounds: window.getBounds(),
      isMaximized: window.isMaximized()
    });
  });
}

function readWindowState(): SavedWindowState | null {
  try {
    const rawState = fs.readFileSync(statePath(), "utf8");
    const parsedState = JSON.parse(rawState) as Partial<SavedWindowState>;

    if (!parsedState.bounds) {
      return null;
    }

    return {
      bounds: parsedState.bounds,
      isMaximized: Boolean(parsedState.isMaximized)
    };
  } catch {
    return null;
  }
}

function writeWindowState(state: SavedWindowState): void {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

function isVisibleOnAnyDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const horizontallyVisible = bounds.x < area.x + area.width && bounds.x + bounds.width > area.x;
    const verticallyVisible = bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;

    return horizontallyVisible && verticallyVisible;
  });
}
