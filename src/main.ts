import { app, BrowserWindow, nativeImage, shell } from "electron";
import * as path from "node:path";
import { installAppMenu } from "./app-menu";
import {
  installAppCommandMediaControls,
  registerMediaShortcuts,
  sendMediaControl,
  unregisterMediaShortcuts
} from "./media-controls";
import { focusSearch } from "./page-actions";
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
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    savedWindowState = readWindowState();
    windowMode = savedWindowState.windowMode;
    installShellMenu();
    installDockIcon();
    createMainWindow();
    registerMediaShortcuts(() => mainWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
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
  installNavigationPolicy(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
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
    focusSearch: () => {
      void focusSearch(() => mainWindow);
    },
    loadHome: () => {
      void mainWindow?.loadURL(START_URL);
    },
    sendMediaControl: (action) => {
      void sendMediaControl(() => mainWindow, action);
    },
    resetWindowSize,
    toggleAlwaysOnTop,
    toggleMiniPlayer
  });
}

function toggleAlwaysOnTop(): void {
  const window = mainWindow;

  if (!window) {
    return;
  }

  window.setAlwaysOnTop(!window.isAlwaysOnTop(), "floating");
  persistCurrentWindowState();
  installShellMenu();
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

function installDockIcon(): void {
  if (process.platform !== "darwin" || !app.dock) {
    return;
  }

  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "build", "icon.png"));

  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

function installNavigationPolicy(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldLoadInApp(url)) {
      void window.loadURL(url);
    } else {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (shouldLoadInApp(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}

function shouldLoadInApp(rawUrl: string): boolean {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  const host = url.hostname.toLowerCase();

  return isYouTubeHost(host) || isGoogleAccountFlowHost(host);
}

function isYouTubeHost(host: string): boolean {
  return host === "youtube.com" || host.endsWith(".youtube.com");
}

function isGoogleAccountFlowHost(host: string): boolean {
  return [
    "accounts.google.com",
    "myaccount.google.com",
    "pay.google.com",
    "payments.google.com",
    "policies.google.com",
    "support.google.com"
  ].includes(host);
}
