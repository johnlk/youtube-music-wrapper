import { BrowserWindow, globalShortcut, systemPreferences, type WebContents } from "electron";
import { sendPageActionRequest } from "./ipc-bridge";
import { isMusicHost } from "./url-policy";

export type MediaControlAction = "playPause" | "nextTrack" | "previousTrack";

type WindowProvider = () => BrowserWindow | null;

type RegisteredMediaShortcut = {
  accelerator: string;
  action: MediaControlAction;
  registered: boolean;
};

const MEDIA_SHORTCUTS: Array<{ accelerator: string; action: MediaControlAction }> = [
  { accelerator: "MediaPlayPause", action: "playPause" },
  { accelerator: "MediaNextTrack", action: "nextTrack" },
  { accelerator: "MediaPreviousTrack", action: "previousTrack" }
];

const APP_COMMANDS: Record<string, MediaControlAction> = {
  "media-next-track": "nextTrack",
  "media-nexttrack": "nextTrack",
  "media-play-pause": "playPause",
  "media-previous-track": "previousTrack",
  "media-previoustrack": "previousTrack"
};

// YouTube Music's documented keyboard shortcuts. Locale-independent, so they
// are our last-resort fallback when DOM walkers can't find a button.
const KEYBOARD_FALLBACKS: Record<MediaControlAction, { keyCode: string; modifiers: string[] }> = {
  playPause: { keyCode: "Space", modifiers: [] },
  nextTrack: { keyCode: "j", modifiers: ["shift"] },
  previousTrack: { keyCode: "k", modifiers: ["shift"] }
};

export function registerMediaShortcuts(getWindow: WindowProvider): RegisteredMediaShortcut[] {
  const registeredShortcuts = MEDIA_SHORTCUTS.map(({ accelerator, action }) => {
    const registered = safeRegisterShortcut(accelerator, () => {
      void sendMediaControl(getWindow, action);
    });

    return { accelerator, action, registered };
  });

  const failedShortcuts = registeredShortcuts.filter((shortcut) => !shortcut.registered);

  if (failedShortcuts.length > 0) {
    const names = failedShortcuts.map((shortcut) => shortcut.accelerator).join(", ");
    const accessibilityHint =
      process.platform === "darwin" && !systemPreferences.isTrustedAccessibilityClient(false)
        ? " macOS may require Accessibility permission for hardware media keys."
        : "";

    console.warn(`[media-controls] Failed to register media shortcuts: ${names}.${accessibilityHint}`);
  }

  return registeredShortcuts;
}

export function unregisterMediaShortcuts(): void {
  for (const { accelerator } of MEDIA_SHORTCUTS) {
    globalShortcut.unregister(accelerator);
  }
}

export function installAppCommandMediaControls(window: BrowserWindow): void {
  window.on("app-command", (event, command) => {
    const action = APP_COMMANDS[command];

    if (!action) {
      return;
    }

    event.preventDefault();
    void sendMediaControl(() => window, action);
  });
}

export async function sendMediaControl(getWindow: WindowProvider, action: MediaControlAction): Promise<boolean> {
  const window = getWindow();

  if (!window || window.isDestroyed()) {
    return false;
  }

  const webContents = window.webContents;

  if (!isMusicHost(webContents.getURL())) {
    return false;
  }

  const result = await sendPageActionRequest(webContents, "media-control", action);

  if (result.handled) {
    return true;
  }

  // Fall back to YT Music's documented keyboard shortcut. These don't depend
  // on the page's locale or DOM structure.
  if (sendKeyboardFallback(webContents, action)) {
    console.info(`[media-controls] ${action} routed via keyboard fallback (DOM reason: ${result.reason ?? "unknown"}).`);
    return true;
  }

  console.warn(`[media-controls] ${action} was not handled by the page${formatReason(result.reason)}.`);
  return false;
}

function sendKeyboardFallback(webContents: WebContents, action: MediaControlAction): boolean {
  const fallback = KEYBOARD_FALLBACKS[action];
  if (!fallback) {
    return false;
  }

  try {
    webContents.sendInputEvent({
      type: "keyDown",
      keyCode: fallback.keyCode,
      modifiers: fallback.modifiers as Electron.InputEvent["modifiers"]
    });
    webContents.sendInputEvent({
      type: "char",
      keyCode: fallback.keyCode,
      modifiers: fallback.modifiers as Electron.InputEvent["modifiers"]
    });
    webContents.sendInputEvent({
      type: "keyUp",
      keyCode: fallback.keyCode,
      modifiers: fallback.modifiers as Electron.InputEvent["modifiers"]
    });
    return true;
  } catch (error) {
    console.warn(`[media-controls] keyboard fallback for ${action} failed: ${getErrorMessage(error)}.`);
    return false;
  }
}

function safeRegisterShortcut(accelerator: string, callback: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, callback);
  } catch (error) {
    console.warn(`[media-controls] Invalid shortcut ${accelerator}: ${getErrorMessage(error)}.`);
    return false;
  }
}

function formatReason(reason: string | undefined): string {
  return reason ? `: ${reason}` : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
