import { BrowserWindow, clipboard, Menu, shell, type MenuItemConstructorOptions } from "electron";

const APP_NAME = "YouTube Music Wrapper";

type WindowProvider = () => BrowserWindow | null;

export function installAppMenu(getWindow: WindowProvider): void {
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
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Navigation",
      submenu: [
        {
          label: "Back",
          accelerator: "CommandOrControl+[",
          click: () => getWindow()?.webContents.goBack()
        },
        {
          label: "Forward",
          accelerator: "CommandOrControl+]",
          click: () => getWindow()?.webContents.goForward()
        },
        {
          label: "Reload",
          accelerator: "CommandOrControl+R",
          click: () => getWindow()?.webContents.reload()
        },
        { type: "separator" },
        {
          label: "Copy Current URL",
          accelerator: "CommandOrControl+Shift+C",
          click: () => {
            const url = getWindow()?.webContents.getURL();
            if (url) {
              clipboard.writeText(url);
            }
          }
        },
        {
          label: "Open Current URL in Browser",
          accelerator: "CommandOrControl+Shift+O",
          click: () => {
            const url = getWindow()?.webContents.getURL();
            if (url) {
              void shell.openExternal(url);
            }
          }
        }
      ]
    },
    {
      label: "View",
      submenu: [
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
