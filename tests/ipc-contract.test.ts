import { describe, expect, test } from "bun:test";
import { isMediaControlAction, isPageActionResult } from "../src/ipc-contract";

describe("IPC contract validation", () => {
  test("accepts valid page action results", () => {
    expect(isPageActionResult({ handled: true })).toBe(true);
    expect(isPageActionResult({ handled: false, reason: "timeout" })).toBe(true);
    expect(isPageActionResult({ handled: true, method: "selector:#play-pause-button" })).toBe(true);
    expect(isPageActionResult({ handled: false, method: undefined, reason: undefined })).toBe(true);
  });

  test("rejects invalid page action result shapes", () => {
    expect(isPageActionResult(null)).toBe(false);
    expect(isPageActionResult(undefined)).toBe(false);
    expect(isPageActionResult("handled")).toBe(false);
    expect(isPageActionResult({})).toBe(false);
    expect(isPageActionResult({ handled: "true" })).toBe(false);
    expect(isPageActionResult({ handled: true, method: 1 })).toBe(false);
    expect(isPageActionResult({ handled: false, reason: false })).toBe(false);
  });

  test("validates supported media control actions", () => {
    expect(isMediaControlAction("playPause")).toBe(true);
    expect(isMediaControlAction("nextTrack")).toBe(true);
    expect(isMediaControlAction("previousTrack")).toBe(true);
    expect(isMediaControlAction("stop")).toBe(false);
    expect(isMediaControlAction("play")).toBe(false);
    expect(isMediaControlAction(null)).toBe(false);
  });
});
