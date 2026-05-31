import { describe, expect, test } from "bun:test";
import { isMusicHost, shouldLoadInApp } from "../src/url-policy";

describe("URL policy", () => {
  test("allows the YouTube Music app and sign-in hosts inside the wrapper", () => {
    expect(shouldLoadInApp("https://music.youtube.com/")).toBe(true);
    expect(shouldLoadInApp("https://music.youtube.com/watch?v=abc123")).toBe(true);
    expect(shouldLoadInApp("https://accounts.google.com/signin")).toBe(true);
    expect(shouldLoadInApp("https://accounts.youtube.com/")).toBe(true);
    expect(shouldLoadInApp("https://consent.youtube.com/m")).toBe(true);
    expect(shouldLoadInApp("https://consent.google.com/")).toBe(true);
    expect(shouldLoadInApp("https://myaccount.google.com/")).toBe(true);
    expect(shouldLoadInApp("https://policies.google.com/privacy")).toBe(true);
  });

  test("rejects external hosts, malformed URLs, and non-HTTP(S) protocols", () => {
    expect(shouldLoadInApp("https://www.youtube.com/watch?v=abc123")).toBe(false);
    expect(shouldLoadInApp("https://music.youtube.com.evil.example/")).toBe(false);
    expect(shouldLoadInApp("https://example.com/")).toBe(false);
    expect(shouldLoadInApp("file:///Users/test/music.html")).toBe(false);
    expect(shouldLoadInApp("javascript:alert(1)")).toBe(false);
    expect(shouldLoadInApp("not a url")).toBe(false);
  });

  test("scopes page actions to music.youtube.com only", () => {
    expect(isMusicHost("https://music.youtube.com/playlist?list=abc")).toBe(true);
    expect(isMusicHost("https://MUSIC.YOUTUBE.COM/")).toBe(true);
    expect(isMusicHost("https://accounts.google.com/signin")).toBe(false);
    expect(isMusicHost("https://consent.youtube.com/")).toBe(false);
    expect(isMusicHost("https://www.youtube.com/")).toBe(false);
    expect(isMusicHost("not a url")).toBe(false);
  });
});
