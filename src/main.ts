import { app, BrowserWindow, shell } from "electron";
import * as path from "node:path";
import { installAppMenu } from "./app-menu";
import { getInitialWindowOptions, trackWindowState } from "./window-state";

const APP_NAME = "YouTube Music Wrapper";
const START_URL = "https://music.youtube.com/";
const SESSION_PARTITION = "persist:youtube-music";

let mainWindow: BrowserWindow | null = null;

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
    installAppMenu(() => mainWindow);
    createMainWindow();

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
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...getInitialWindowOptions(),
    title: APP_NAME,
    backgroundColor: "#0f0f0f",
    minWidth: 960,
    minHeight: 640,
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
  trackWindowState(window);
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

  return (
    host === "music.youtube.com" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "google.com" ||
    host.endsWith(".google.com")
  );
}
