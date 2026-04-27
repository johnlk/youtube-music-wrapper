import { BrowserWindow, type WebContents } from "electron";
import { sendPageActionRequest } from "./ipc-bridge";
import { isMusicHost } from "./url-policy";

type WindowProvider = () => BrowserWindow | null;

export async function focusSearch(getWindow: WindowProvider): Promise<boolean> {
  const window = getWindow();

  if (!window || window.isDestroyed()) {
    return false;
  }

  const webContents = window.webContents;

  if (!isMusicHost(webContents.getURL())) {
    return false;
  }

  const result = await sendPageActionRequest(webContents, "focus-search");

  if (result.handled) {
    return true;
  }

  // Locale-independent fallback: YT Music binds "/" to focus the search box.
  if (sendSlashKeyFallback(webContents)) {
    console.info(`[page-actions] focusSearch routed via keyboard fallback (DOM reason: ${result.reason ?? "unknown"}).`);
    return true;
  }

  console.warn(`[page-actions] focusSearch was not handled by the page${formatReason(result.reason)}.`);
  return false;
}

function sendSlashKeyFallback(webContents: WebContents): boolean {
  try {
    webContents.sendInputEvent({ type: "keyDown", keyCode: "/" });
    webContents.sendInputEvent({ type: "char", keyCode: "/" });
    webContents.sendInputEvent({ type: "keyUp", keyCode: "/" });
    return true;
  } catch (error) {
    console.warn(`[page-actions] keyboard fallback failed: ${getErrorMessage(error)}.`);
    return false;
  }
}

function formatReason(reason: string | undefined): string {
  return reason ? `: ${reason}` : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
