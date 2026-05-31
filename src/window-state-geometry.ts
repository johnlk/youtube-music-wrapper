import type { Rectangle } from "electron";

// Sanity bound: anything larger than this is almost certainly corrupt or
// hostile state. Window managers cap at far less, but this keeps the JSON
// parser from passing absurd values into Electron's bounds APIs.
const MAX_BOUND_DIMENSION = 32768;
const MAX_BOUND_COORDINATE = 100000;

export function coerceWindowBounds(bounds: Partial<Rectangle> | undefined): Rectangle | undefined {
  if (
    bounds &&
    isFiniteNumber(bounds.x) &&
    isFiniteNumber(bounds.y) &&
    isFiniteNumber(bounds.width) &&
    isFiniteNumber(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.width <= MAX_BOUND_DIMENSION &&
    bounds.height <= MAX_BOUND_DIMENSION &&
    Math.abs(bounds.x) <= MAX_BOUND_COORDINATE &&
    Math.abs(bounds.y) <= MAX_BOUND_COORDINATE
  ) {
    return {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  }

  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
