import { BrowserWindow, clipboard, Menu, ShareMenu, shell, type MenuItemConstructorOptions } from "electron";
import type { MediaControlAction } from "./media-controls";
import type { WindowMode } from "./window-state";

const APP_NAME = "YouTube Music Wrapper";

type WindowProvider = () => BrowserWindow | null;

type AppMenuState = {
  isAlwaysOnTop: boolean;
  windowMode: WindowMode;
};

type AppMenuController = {
  getWindow: WindowProvider;
  getState: () => AppMenuState;
  loadHome: () => void;
  sendMediaControl: (action: MediaControlAction) => void;
  toggleAlwaysOnTop: () => void;
  toggleMiniPlayer: () => void;
  resetWindowSize: () => void;
};

export function installAppMenu(controller: AppMenuController): void {
  const state = controller.getState();
  const template: MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "Share Current Page",
          accelerator: "CommandOrControl+Shift+S",
          click: () => shareCurrentPage(controller.getWindow())
        },
        {
          label: "Copy Current URL",
          accelerator: "CommandOrControl+Shift+C",
          click: () => copyCurrentUrl(controller.getWindow())
        },
        {
          label: "Open Current URL in Browser",
          accelerator: "CommandOrControl+Shift+O",
          click: () => openCurrentUrl(controller.getWindow())
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
        { role: "startSpeaking" },
        { role: "stopSpeaking" }
      ]
    },
    {
      label: "Navigation",
      submenu: [
        {
          label: "Back",
          accelerator: "CommandOrControl+[",
          click: () => controller.getWindow()?.webContents.goBack()
        },
        {
          label: "Forward",
          accelerator: "CommandOrControl+]",
          click: () => controller.getWindow()?.webContents.goForward()
        },
        {
          label: "YouTube Music Home",
          accelerator: "CommandOrControl+L",
          click: controller.loadHome
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CommandOrControl+R",
          click: () => controller.getWindow()?.webContents.reload()
        }
      ]
    },
    {
      label: "Playback",
      submenu: [
        {
          label: "Play/Pause",
          click: () => controller.sendMediaControl("playPause")
        },
        {
          label: "Next Track",
          click: () => controller.sendMediaControl("nextTrack")
        },
        {
          label: "Previous Track",
          click: () => controller.sendMediaControl("previousTrack")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        {
          label: "Always on Top",
          type: "checkbox",
          checked: state.isAlwaysOnTop,
          accelerator: "CommandOrControl+Shift+T",
          click: controller.toggleAlwaysOnTop
        },
        {
          label: "Mini Player",
          type: "checkbox",
          checked: state.windowMode === "mini",
          accelerator: "CommandOrControl+Shift+M",
          click: controller.toggleMiniPlayer
        },
        {
          label: "Reset Window Size",
          click: controller.resetWindowSize
        },
        { type: "separator" },
        { role: "toggleDevTools" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function shareCurrentPage(window: BrowserWindow | null): void {
  const url = window?.webContents.getURL();

  if (!window || !url) {
    return;
  }

  const title = window.webContents.getTitle();

  if (process.platform === "darwin") {
    new ShareMenu({
      texts: title && title !== url ? [title] : undefined,
      urls: [url]
    }).popup({ window });
    return;
  }

  clipboard.writeText(url);
}

function copyCurrentUrl(window: BrowserWindow | null): void {
  const url = window?.webContents.getURL();

  if (url) {
    clipboard.writeText(url);
  }
}

function openCurrentUrl(window: BrowserWindow | null): void {
  const url = window?.webContents.getURL();

  if (url) {
    void shell.openExternal(url);
  }
}
