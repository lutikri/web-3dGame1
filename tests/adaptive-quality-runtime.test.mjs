import assert from "node:assert/strict";
import test from "node:test";

import { resolveGraphicsPixelRatio } from "../src/config/GraphicsQualityProfiles.js";
import { AdaptiveQualityRuntime } from "../src/runtime/AdaptiveQualityRuntime.js";

test("graphics profiles cap their drawing buffer pixel budgets", () => {
  assert.equal(resolveGraphicsPixelRatio("medium", 1920, 1080), 0.75);
  assert.equal(resolveGraphicsPixelRatio("medium", 3840, 2160), 0.5);
  assert.equal(resolveGraphicsPixelRatio("high", 3840, 2160).toFixed(3), "0.667");
  assert.equal(resolveGraphicsPixelRatio("low", 3840, 2160).toFixed(3), "0.333");
});

test("adaptive quality lowers resolution once after sustained low foreground fps", () => {
  let now = 0;
  const applied = [];
  const runtime = new AdaptiveQualityRuntime({
    applyPixelRatio: (ratio) => applied.push(ratio),
    getViewport: () => ({ width: 1920, height: 1080 }),
    shouldSample: () => true,
    now: () => now,
    settleDurationMs: 0,
    sampleWindowMs: 1000,
    lowFpsThreshold: 48,
    lowConfirmWindows: 2,
  });
  runtime.configure("medium");

  for (let window = 0; window < 2; window += 1) {
    for (let frame = 0; frame < 40; frame += 1) {
      now += 25;
      runtime.update();
    }
  }

  assert.equal(runtime.snapshot().degraded, true);
  assert.equal(runtime.snapshot().pixelRatio, 0.637);
  assert.equal(applied.at(-1).toFixed(4), (0.75 * 0.85).toFixed(4));
});

test("adaptive quality ignores background samples and only recommends low after critical degraded windows", () => {
  let now = 0;
  let foreground = false;
  const runtime = new AdaptiveQualityRuntime({
    applyPixelRatio: () => {},
    getViewport: () => ({ width: 1920, height: 1080 }),
    shouldSample: () => foreground,
    now: () => now,
    settleDurationMs: 0,
    sampleWindowMs: 1000,
    lowConfirmWindows: 1,
    criticalConfirmWindows: 2,
  });
  runtime.configure("high");
  for (let frame = 0; frame < 5; frame += 1) {
    now += 1000;
    runtime.update();
  }
  assert.equal(runtime.snapshot().degraded, false);

  foreground = true;
  for (let frame = 0; frame < 30; frame += 1) {
    now += 40;
    runtime.update();
  }
  assert.equal(runtime.snapshot().degraded, true);
  for (let window = 0; window < 2; window += 1) {
    for (let frame = 0; frame < 25; frame += 1) {
      now += 40;
      runtime.update();
    }
  }
  assert.equal(runtime.snapshot().lowRecommended, true);
});
