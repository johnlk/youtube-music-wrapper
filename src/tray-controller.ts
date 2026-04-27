import { app, BrowserWindow, Menu, nativeImage, Tray, type MenuItemConstructorOptions, type NativeImage } from "electron";
import * as path from "node:path";
import type { MediaControlAction } from "./media-controls";
import type { WindowMode } from "./window-state";

const APP_NAME = "YouTube Music Wrapper";
const TRAY_ICON_SIZE = process.platform === "darwin" ? 18 : 20;

type WindowProvider = () => BrowserWindow | null;

type TrayControllerState = {
  isAlwaysOnTop: boolean;
  isWindowVisible: boolean;
  windowMode: WindowMode;
};

type TrayController = {
  getWindow: WindowProvider;
  getState: () => TrayControllerState;
  focusSearch: () => void;
  loadHome: () => void;
  sendMediaControl: (action: MediaControlAction) => void;
  toggleAlwaysOnTop: () => void;
  toggleMiniPlayer: () => void;
  toggleWindowVisibility: () => void;
};

let tray: Tray | null = null;
let trayController: TrayController | null = null;

export function installTrayController(controller: TrayController): Tray | null {
  const icon = createTrayIcon();

  if (icon.isEmpty()) {
    console.warn("[tray-controller] Skipping tray controller because no usable tray icon was found.");
    return null;
  }

  trayController = controller;

  if (tray) {
    tray.destroy();
  }

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    controller.toggleWindowVisibility();
    updateTrayControllerMenu();
  });
  tray.on("right-click", updateTrayControllerMenu);
  updateTrayControllerMenu();

  return tray;
}

export function updateTrayControllerMenu(): void {
  if (!tray || !trayController) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu(trayController)));
}

function buildTrayMenu(controller: TrayController): MenuItemConstructorOptions[] {
  const state = controller.getState();

  return [
    {
      label: state.isWindowVisible ? "Hide Window" : "Show Window",
      click: runAndRefresh(controller.toggleWindowVisibility)
    },
    {
      label: "YouTube Music Home",
      click: runAndRefresh(controller.loadHome)
    },
    {
      label: "Focus Search",
      click: runAndRefresh(controller.focusSearch)
    },
    { type: "separator" },
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
    },
    { type: "separator" },
    {
      label: "Mini Player",
      type: "checkbox",
      checked: state.windowMode === "mini",
      click: runAndRefresh(controller.toggleMiniPlayer)
    },
    {
      label: "Always on Top",
      type: "checkbox",
      checked: state.isAlwaysOnTop,
      click: runAndRefresh(controller.toggleAlwaysOnTop)
    },
    { type: "separator" },
    { role: "quit" }
  ];
}

function runAndRefresh(action: () => void): () => void {
  return () => {
    action();
    updateTrayControllerMenu();
  };
}

function createTrayIcon(): NativeImage {
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "build", "icon.png"));

  if (icon.isEmpty()) {
    return icon;
  }

  const resizedIcon = icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });

  if (process.platform === "darwin") {
    resizedIcon.setTemplateImage(true);
  }

  return resizedIcon;
}
