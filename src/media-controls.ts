import { BrowserWindow, globalShortcut, systemPreferences } from "electron";

export type MediaControlAction = "playPause" | "nextTrack" | "previousTrack";

type WindowProvider = () => BrowserWindow | null;

type RegisteredMediaShortcut = {
  accelerator: string;
  action: MediaControlAction;
  registered: boolean;
};

type MediaControlResult = {
  handled: boolean;
  method?: string;
  reason?: string;
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

  if (!isYouTubeMusicPage(window.webContents.getURL())) {
    return false;
  }

  try {
    const result = (await window.webContents.executeJavaScript(createMediaControlScript(action), true)) as
      | MediaControlResult
      | undefined;

    if (!result?.handled) {
      console.warn(`[media-controls] ${action} was not handled by the page${formatReason(result?.reason)}.`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[media-controls] ${action} failed: ${getErrorMessage(error)}.`);
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

function isYouTubeMusicPage(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname.toLowerCase() === "music.youtube.com";
  } catch {
    return false;
  }
}

function createMediaControlScript(action: MediaControlAction): string {
  return `
    (async () => {
      const action = ${JSON.stringify(action)};
      const controls = {
        playPause: {
          labels: ["play", "pause"],
          selectors: [
            "ytmusic-player-bar #play-pause-button",
            "ytmusic-player-bar .play-pause-button",
            "#play-pause-button"
          ]
        },
        nextTrack: {
          labels: ["next", "next song", "next track"],
          selectors: [
            "ytmusic-player-bar .next-button",
            "ytmusic-player-bar [aria-label='Next']",
            ".next-button"
          ]
        },
        previousTrack: {
          labels: ["previous", "previous song", "previous track"],
          selectors: [
            "ytmusic-player-bar .previous-button",
            "ytmusic-player-bar [aria-label='Previous']",
            ".previous-button"
          ]
        }
      };

      const config = controls[action];

      if (!config) {
        return { handled: false, reason: "unknown action" };
      }

      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };

      const isDisabled = (element) =>
        element.disabled === true ||
        element.getAttribute("aria-disabled") === "true" ||
        element.hasAttribute("disabled");

      const clickControl = (element, method) => {
        if (!element || !isVisible(element) || isDisabled(element)) {
          return { handled: false };
        }

        element.click();
        return { handled: true, method };
      };

      const clickBySelector = () => {
        for (const selector of config.selectors) {
          const result = clickControl(document.querySelector(selector), "selector:" + selector);

          if (result.handled) {
            return result;
          }
        }

        return { handled: false };
      };

      const clickByLabel = () => {
        const candidates = Array.from(document.querySelectorAll("button, tp-yt-paper-icon-button, yt-icon-button"));

        for (const element of candidates) {
          const label = [element.getAttribute("aria-label"), element.getAttribute("title")]
            .filter(Boolean)
            .join(" ")
            .trim()
            .toLowerCase();

          const matchesLabel = config.labels.some(
            (expected) => label === expected || label.startsWith(expected + " ") || label.includes(" " + expected)
          );

          if (!matchesLabel) {
            continue;
          }

          const result = clickControl(element, "label:" + label);

          if (result.handled) {
            return result;
          }
        }

        return { handled: false };
      };

      const controlMediaElement = async () => {
        if (action !== "playPause") {
          return { handled: false };
        }

        const media = Array.from(document.querySelectorAll("video, audio")).find(
          (element) => element.readyState > 0 || !element.paused
        );

        if (!media) {
          return { handled: false };
        }

        if (media.paused) {
          await media.play();
        } else {
          media.pause();
        }

        return { handled: true, method: "media-element" };
      };

      try {
        const mediaResult = await controlMediaElement();

        if (mediaResult.handled) {
          return mediaResult;
        }
      } catch {
        const buttonResult = clickBySelector();

        if (buttonResult.handled) {
          return buttonResult;
        }
      }

      const labelResult = clickByLabel();

      if (labelResult.handled) {
        return labelResult;
      }

      const selectorResult = clickBySelector();

      if (selectorResult.handled) {
        return selectorResult;
      }

      return { handled: false, reason: "no enabled YouTube Music control found" };
    })();
  `;
}

function formatReason(reason: string | undefined): string {
  return reason ? `: ${reason}` : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
