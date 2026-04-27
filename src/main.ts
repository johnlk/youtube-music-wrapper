import { app, BrowserWindow, nativeImage } from "electron";
import * as path from "node:path";
import { installAppMenu } from "./app-menu";
import {
  installAppCommandMediaControls,
  registerMediaShortcuts,
  sendMediaControl,
  type MediaControlAction,
  unregisterMediaShortcuts
} from "./media-controls";
import { focusSearch } from "./page-actions";
import { installGlobalWebContentsPolicy, installSessionPolicy } from "./security";
import { installTrayController, updateTrayControllerMenu } from "./tray-controller";
import {
  applyWindowMode,
  captureWindowState,
  getInitialWindowOptions,
  readWindowState,
  restoreWindowPresentation,
  trackWindowState,
  type SavedWindowState,
  type WindowMode,
  writeWindowState
} from "./window-state";

const APP_NAME = "YouTube Music Wrapper";
const START_URL = "https://music.youtube.com/";
const SESSION_PARTITION = "persist:youtube-music";

let mainWindow: BrowserWindow | null = null;
let savedWindowState: SavedWindowState | null = null;
let windowMode: WindowMode = "standard";

app.setName(APP_NAME);

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, workingDirectory) => {
    // Reserved for future deep-link handling (e.g. youtubemusic:// URLs).
    // For now we just log the inputs and surface the existing window.
    if (argv.length > 0) {
      console.info(`[main] second-instance argv=${JSON.stringify(argv)} cwd=${workingDirectory}`);
    }

    showMainWindow();
  });

  installGlobalWebContentsPolicy();

  void app.whenReady().then(() => {
    savedWindowState = readWindowState();
    windowMode = savedWindowState.windowMode;
    installSessionPolicy(SESSION_PARTITION);
    installShellMenu();
    installDockIcon();
    createMainWindow();
    installTrayMenu();
    registerMediaShortcuts(() => mainWindow);

    app.on("activate", () => {
      showMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("will-quit", () => {
    unregisterMediaShortcuts();
  });
}

function createMainWindow(): BrowserWindow {
  const initialWindowState = getSavedWindowState();
  const window = new BrowserWindow({
    ...getInitialWindowOptions(initialWindowState),
    title: APP_NAME,
    backgroundColor: "#0f0f0f",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: SESSION_PARTITION,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true
    }
  });

  mainWindow = window;
  restoreWindowPresentation(window, initialWindowState);
  trackWindowState(window, persistCurrentWindowState);
  installAppCommandMediaControls(window);
  installLoadFailureRecovery(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      updateTrayControllerMenu();
    }
  });

  void window.loadURL(START_URL);

  return window;
}

function installShellMenu(): void {
  installAppMenu({
    getWindow: () => mainWindow,
    getState: () => ({
      isAlwaysOnTop: Boolean(mainWindow?.isAlwaysOnTop() ?? getSavedWindowState().isAlwaysOnTop),
      windowMode
    }),
    focusSearch: focusSearchInMainWindow,
    loadHome,
    sendMediaControl: sendMediaControlToMainWindow,
    resetWindowSize,
    toggleAlwaysOnTop,
    toggleMiniPlayer
  });
}

function installTrayMenu(): void {
  installTrayController({
    getWindow: () => mainWindow,
    getState: () => ({
      isAlwaysOnTop: Boolean(mainWindow?.isAlwaysOnTop() ?? getSavedWindowState().isAlwaysOnTop),
      isWindowVisible: Boolean(mainWindow?.isVisible()),
      windowMode
    }),
    focusSearch: focusSearchInMainWindow,
    loadHome,
    sendMediaControl: sendMediaControlToMainWindow,
    toggleAlwaysOnTop,
    toggleMiniPlayer,
    toggleWindowVisibility
  });
}

function showMainWindow(): BrowserWindow {
  const window = mainWindow ?? createMainWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    window.show();
  }

  window.focus();
  updateTrayControllerMenu();

  return window;
}

function toggleWindowVisibility(): void {
  if (mainWindow?.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    updateTrayControllerMenu();
    return;
  }

  showMainWindow();
}

function loadHome(): void {
  const window = showMainWindow();

  void window.loadURL(START_URL);
}

function focusSearchInMainWindow(): void {
  showMainWindow();
  void focusSearch(() => mainWindow);
}

function sendMediaControlToMainWindow(action: MediaControlAction): void {
  void sendMediaControl(() => mainWindow, action);
}

function toggleAlwaysOnTop(): void {
  const window = mainWindow;

  if (!window) {
    return;
  }

  window.setAlwaysOnTop(!window.isAlwaysOnTop(), "floating");
  persistCurrentWindowState();
  installShellMenu();
  updateTrayControllerMenu();
}

function toggleMiniPlayer(): void {
  const window = mainWindow;

  if (!window) {
    return;
  }

  persistCurrentWindowState();
  windowMode = windowMode === "mini" ? "standard" : "mini";
  applyWindowMode(window, windowMode, getSavedWindowState());
  persistCurrentWindowState();
  installShellMenu();
  updateTrayControllerMenu();
}

function resetWindowSize(): void {
  const window = mainWindow;

  if (!window) {
    return;
  }

  savedWindowState = {
    ...getSavedWindowState(),
    standardBounds: undefined,
    miniBounds: undefined,
    isMaximized: false,
    isFullScreen: false
  };

  applyWindowMode(window, windowMode, savedWindowState);
  persistCurrentWindowState();
  updateTrayControllerMenu();
}

function persistCurrentWindowState(): void {
  if (mainWindow) {
    savedWindowState = captureWindowState(mainWindow, getSavedWindowState(), windowMode);
  }

  writeWindowState(getSavedWindowState());
}

function getSavedWindowState(): SavedWindowState {
  if (!savedWindowState) {
    savedWindowState = readWindowState();
    windowMode = savedWindowState.windowMode;
  }

  return savedWindowState;
}

function installLoadFailureRecovery(window: BrowserWindow): void {
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      // -3 / ABORTED is fired during normal navigation cancellation; ignore.
      if (errorCode === -3) {
        return;
      }

      console.warn(
        `[main] did-fail-load url=${validatedURL} code=${errorCode} description=${errorDescription}`
      );

      void window.loadURL(buildErrorPageUrl(errorDescription || "Unable to reach YouTube Music."));
    }
  );
}

function buildErrorPageUrl(message: string): string {
  const safeMessage = String(message).replace(/[<>&]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      default:
        return character;
    }
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>YouTube Music Wrapper — offline</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0f0f0f;
        color: #f1f1f1;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }
      main { max-width: 480px; padding: 32px; text-align: center; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      p { color: #aaa; margin: 0 0 24px; line-height: 1.5; }
      button {
        appearance: none;
        background: #ff0033;
        color: white;
        border: 0;
        border-radius: 999px;
        padding: 10px 20px;
        font-size: 14px;
        cursor: pointer;
      }
      button:hover { filter: brightness(1.1); }
    </style>
  </head>
  <body>
    <main>
      <h1>Couldn't reach YouTube Music</h1>
      <p>${safeMessage}</p>
      <button onclick="location.href='${START_URL}'">Try again</button>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function installDockIcon(): void {
  if (process.platform !== "darwin" || !app.dock) {
    return;
  }

  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "build", "icon.png"));

  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}


