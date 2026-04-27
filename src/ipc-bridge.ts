import { ipcMain, type WebContents } from "electron";
import { isPageActionResult, type PageActionResult } from "./ipc-contract";

// Main-process side of the request/response pattern used to talk to the
// preload script in the isolated world. We assign a numeric correlation id to
// every request and listen on a per-request reply channel, so concurrent
// requests don't trample each other's responses.

const REQUEST_CHANNEL = "ymw:request";
const RESPONSE_CHANNEL_PREFIX = "ymw:response:";
const DEFAULT_TIMEOUT_MS = 5000;
// Hard upper bound on payload sizes the renderer can return. Keeps a
// compromised renderer from flooding the main process via the bridge.
const RESPONSE_SIZE_LIMIT = 32 * 1024;

let nextRequestId = 1;

export type SendOptions = {
  timeoutMs?: number;
  /**
   * If true, wait for the main frame to finish loading before sending the
   * request. Avoids the silent no-op when a media key fires while the page
   * is still loading.
   */
  awaitReady?: boolean;
};

export async function sendPageActionRequest(
  webContents: WebContents,
  action: string,
  payload?: unknown,
  options: SendOptions = {}
): Promise<PageActionResult> {
  if (webContents.isDestroyed()) {
    return { handled: false, reason: "webContents destroyed" };
  }

  if (options.awaitReady !== false) {
    try {
      await waitForLoad(webContents, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    } catch (error) {
      return { handled: false, reason: errorMessage(error) };
    }

    if (webContents.isDestroyed()) {
      return { handled: false, reason: "webContents destroyed" };
    }
  }

  const id = nextRequestId++;
  const responseChannel = `${RESPONSE_CHANNEL_PREFIX}${id}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<PageActionResult>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      ipcMain.removeListener(responseChannel, listener);
      webContents.off("destroyed", onDestroyed);
    };

    const settle = (result: PageActionResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const listener = (event: Electron.IpcMainEvent, raw: unknown) => {
      // Only accept replies from the webContents we sent the request to.
      if (event.sender.id !== webContents.id) {
        return;
      }

      if (!isUnderSizeLimit(raw)) {
        settle({ handled: false, reason: "response too large" });
        return;
      }

      if (!isPageActionResult(raw)) {
        settle({ handled: false, reason: "invalid response shape" });
        return;
      }

      settle(raw);
    };

    const onDestroyed = () => settle({ handled: false, reason: "webContents destroyed" });

    ipcMain.on(responseChannel, listener);
    webContents.once("destroyed", onDestroyed);

    timer = setTimeout(() => settle({ handled: false, reason: "timeout" }), timeoutMs);

    try {
      webContents.send(REQUEST_CHANNEL, { id, action, payload });
    } catch (error) {
      settle({ handled: false, reason: errorMessage(error) });
    }
  });
}

function waitForLoad(webContents: WebContents, timeoutMs: number): Promise<void> {
  if (!webContents.isLoadingMainFrame()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      webContents.off("did-finish-load", onLoaded);
      webContents.off("did-fail-load", onFailed);
      reject(new Error("page load timed out"));
    }, timeoutMs);

    const onLoaded = () => {
      clearTimeout(timer);
      webContents.off("did-fail-load", onFailed);
      resolve();
    };

    const onFailed = (
      _event: Electron.Event,
      _errorCode: number,
      errorDescription: string,
      _validatedURL: string,
      isMainFrame: boolean
    ) => {
      if (!isMainFrame) {
        return;
      }
      clearTimeout(timer);
      webContents.off("did-finish-load", onLoaded);
      reject(new Error(`page load failed: ${errorDescription}`));
    };

    webContents.once("did-finish-load", onLoaded);
    webContents.on("did-fail-load", onFailed);
  });
}

function isUnderSizeLimit(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= RESPONSE_SIZE_LIMIT;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
