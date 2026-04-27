import { app, session, shell, type WebContents } from "electron";
import { shouldLoadInApp } from "./url-policy";

// Permissions explicitly allowed for the YT Music partition. Every other
// permission request is denied by default.
const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set([
  "notifications",
  "fullscreen",
  "clipboard-read",
  "clipboard-sanitized-write"
]);

export function installSessionPolicy(partition: string): void {
  const targetSession = session.fromPartition(partition);

  targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission);

    if (!allowed) {
      const requesting = safeUrl(details?.requestingUrl) ?? safeUrl(webContents?.getURL() ?? "") ?? "<unknown>";
      console.warn(`[security] Denied permission '${permission}' for ${requesting}.`);
    }

    callback(allowed);
  });

  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission);

    if (!allowed) {
      console.warn(`[security] Permission check denied for '${permission}' from ${requestingOrigin || "<unknown>"}.`);
    }

    return allowed;
  });

  // Deny access to USB / Serial / HID / Bluetooth devices outright.
  targetSession.setDevicePermissionHandler(() => false);
}

export function installGlobalWebContentsPolicy(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (shouldLoadInApp(url)) {
        // Defer to the existing main-window load flow; we still deny the new
        // window because we never want detached windows.
        const focusedTarget = pickInAppNavigationTarget(contents);
        void focusedTarget.loadURL(url);
      } else {
        void shell.openExternal(url);
      }

      return { action: "deny" };
    });

    contents.on("will-navigate", (event, url) => {
      if (shouldLoadInApp(url)) {
        return;
      }

      event.preventDefault();
      void shell.openExternal(url);
    });

    contents.on("will-redirect", (event, url) => {
      if (shouldLoadInApp(url)) {
        return;
      }

      event.preventDefault();
      void shell.openExternal(url);
    });

    contents.on("will-attach-webview", (event, webPreferences, params) => {
      // We never use <webview>; refuse all attachment attempts.
      console.warn(`[security] Blocked <webview> attachment for ${params.src}.`);
      event.preventDefault();
      // Strip dangerous defaults defensively in case a future change calls this
      // path before we can ship a fix.
      delete (webPreferences as { preload?: string }).preload;
      (webPreferences as { nodeIntegration?: boolean }).nodeIntegration = false;
      (webPreferences as { contextIsolation?: boolean }).contextIsolation = true;
    });
  });
}

function pickInAppNavigationTarget(contents: WebContents): WebContents {
  // Prefer the top-level frame's host webContents to avoid loading the URL
  // into a sub-frame webContents instance.
  return contents;
}

function safeUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).toString();
  } catch {
    return null;
  }
}
