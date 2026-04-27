import { BrowserWindow } from "electron";

type WindowProvider = () => BrowserWindow | null;

type PageActionResult = {
  handled: boolean;
  method?: string;
  reason?: string;
};

export async function focusSearch(getWindow: WindowProvider): Promise<boolean> {
  const window = getWindow();

  if (!window || window.isDestroyed()) {
    return false;
  }

  if (!isYouTubeMusicPage(window.webContents.getURL())) {
    return false;
  }

  try {
    const result = (await window.webContents.executeJavaScript(createFocusSearchScript(), true)) as
      | PageActionResult
      | undefined;

    if (!result?.handled) {
      console.warn(`[page-actions] focusSearch was not handled by the page${formatReason(result?.reason)}.`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[page-actions] focusSearch failed: ${getErrorMessage(error)}.`);
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

function createFocusSearchScript(): string {
  return `
    (async () => {
      const inputSelectors = [
        "ytmusic-search-box input#input",
        "ytmusic-search-box input",
        "input[aria-label='Search']",
        "input[aria-label*='Search' i]",
        "input[placeholder='Search']",
        "input[placeholder*='Search' i]",
        "input[type='search']"
      ];

      const controlSelectors = [
        "ytmusic-search-box tp-yt-paper-icon-button",
        "ytmusic-search-box button",
        "a[href^='/search']",
        "a[aria-label='Search']",
        "a[aria-label*='Search' i]",
        "button[aria-label='Search']",
        "button[aria-label*='Search' i]",
        "yt-icon-button[aria-label='Search']",
        "yt-icon-button[aria-label*='Search' i]",
        "tp-yt-paper-icon-button[aria-label='Search']",
        "tp-yt-paper-icon-button[aria-label*='Search' i]",
        "[role='button'][aria-label='Search']",
        "[role='button'][aria-label*='Search' i]"
      ];

      const queryAll = (selectors) => {
        const matches = [];
        const visitedRoots = new Set();

        const visitRoot = (root) => {
          if (!root || visitedRoots.has(root)) {
            return;
          }

          visitedRoots.add(root);

          for (const selector of selectors) {
            matches.push(...Array.from(root.querySelectorAll(selector)));
          }

          for (const element of Array.from(root.querySelectorAll("*"))) {
            if (element.shadowRoot) {
              visitRoot(element.shadowRoot);
            }
          }
        };

        visitRoot(document);
        return matches;
      };

      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };

      const isDisabled = (element) =>
        element.disabled === true ||
        element.getAttribute("aria-disabled") === "true" ||
        element.hasAttribute("disabled");

      const focusInput = (element, method) => {
        if (!element || !isVisible(element) || isDisabled(element)) {
          return { handled: false };
        }

        element.focus();

        if (typeof element.select === "function") {
          element.select();
        }

        return { handled: document.activeElement === element || element.matches(":focus"), method };
      };

      const focusExistingInput = () => {
        for (const element of queryAll(inputSelectors)) {
          const result = focusInput(element, "input");

          if (result.handled) {
            return result;
          }
        }

        return { handled: false };
      };

      const clickSearchControl = () => {
        for (const element of queryAll(controlSelectors)) {
          if (!element || !isVisible(element) || isDisabled(element)) {
            continue;
          }

          element.click();
          return { handled: true, method: "search-control" };
        }

        return { handled: false };
      };

      const waitForInput = () =>
        new Promise((resolve) => {
          const startedAt = Date.now();

          const tick = () => {
            const result = focusExistingInput();

            if (result.handled) {
              resolve(result);
              return;
            }

            if (Date.now() - startedAt > 1000) {
              resolve({ handled: false });
              return;
            }

            window.setTimeout(tick, 50);
          };

          tick();
        });

      const existingInput = focusExistingInput();

      if (existingInput.handled) {
        return existingInput;
      }

      const clickedControl = clickSearchControl();

      if (clickedControl.handled) {
        const inputResult = await waitForInput();

        if (inputResult.handled) {
          return {
            handled: true,
            method: clickedControl.method + " -> " + inputResult.method
          };
        }
      }

      return { handled: false, reason: "no enabled YouTube Music search field found" };
    })();
  `;
}

function formatReason(reason: string | undefined): string {
  return reason ? `: ${reason}` : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
