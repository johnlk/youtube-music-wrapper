import { describe, expect, test } from "bun:test";
import { coerceWindowBounds } from "../src/window-state-geometry";

describe("window bounds sanitizing", () => {
  test("rounds finite positive bounds", () => {
    expect(coerceWindowBounds({ x: 10.2, y: -20.7, width: 640.4, height: 480.6 })).toEqual({
      x: 10,
      y: -21,
      width: 640,
      height: 481
    });
  });

  test("rejects missing, non-finite, non-positive, and extreme bounds", () => {
    expect(coerceWindowBounds(undefined)).toBeUndefined();
    expect(coerceWindowBounds({ x: 0, y: 0, width: 0, height: 480 })).toBeUndefined();
    expect(coerceWindowBounds({ x: 0, y: 0, width: 640, height: -1 })).toBeUndefined();
    expect(coerceWindowBounds({ x: Number.NaN, y: 0, width: 640, height: 480 })).toBeUndefined();
    expect(coerceWindowBounds({ x: 0, y: Number.POSITIVE_INFINITY, width: 640, height: 480 })).toBeUndefined();
    expect(coerceWindowBounds({ x: 0, y: 0, width: 32769, height: 480 })).toBeUndefined();
    expect(coerceWindowBounds({ x: 100001, y: 0, width: 640, height: 480 })).toBeUndefined();
  });
});
