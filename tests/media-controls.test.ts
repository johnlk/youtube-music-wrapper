import { describe, expect, test } from "bun:test";
import { usesSystemNowPlaying } from "../src/now-playing-policy";

describe("system Now Playing", () => {
  test("macOS leaves play, pause, and skip to the system controls", () => {
    expect(usesSystemNowPlaying("darwin")).toBe(true);
  });

  test("other platforms keep the app's media-key shortcuts", () => {
    expect(usesSystemNowPlaying("win32")).toBe(false);
    expect(usesSystemNowPlaying("linux")).toBe(false);
  });
});
