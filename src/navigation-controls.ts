import { BrowserWindow } from "electron";

type NavigationDirection = "back" | "forward";

const APP_COMMAND_MAP: Record<string, NavigationDirection> = {
  "browser-backward": "back",
  "browser-forward": "forward"
};

/**
 * Wires native back/forward navigation gestures to the window's web contents.
 *
 * - Mouse "browser-backward" / "browser-forward" buttons (X1/X2 on 5-button mice).
 * - macOS three-finger trackpad swipe (left = back, right = forward).
 *
 * The standard menu-bar accelerators (Cmd+[ / Cmd+]) are wired separately in
 * `app-menu.ts`.
 */
export function installAppCommandNavigation(window: BrowserWindow): void {
  window.on("app-command", (event, command) => {
    const direction = APP_COMMAND_MAP[command];

    if (!direction) {
      return;
    }

    if (navigate(window, direction)) {
      event.preventDefault();
    }
  });

  if (process.platform === "darwin") {
    window.on("swipe", (event, direction) => {
      if (direction === "left" && navigate(window, "back")) {
        event.preventDefault();
      } else if (direction === "right" && navigate(window, "forward")) {
        event.preventDefault();
      }
    });
  }
}

export function navigateBack(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  return navigate(window, "back");
}

export function navigateForward(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  return navigate(window, "forward");
}

export function canNavigateBack(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  return window.webContents.navigationHistory.canGoBack();
}

export function canNavigateForward(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  return window.webContents.navigationHistory.canGoForward();
}

function navigate(window: BrowserWindow, direction: NavigationDirection): boolean {
  const history = window.webContents.navigationHistory;

  if (direction === "back") {
    if (!history.canGoBack()) {
      return false;
    }

    history.goBack();
    return true;
  }

  if (!history.canGoForward()) {
    return false;
  }

  history.goForward();
  return true;
}
