import test from "node:test";
import assert from "node:assert/strict";

import { measureBenchmarkFrames } from "../src/ui/debug/PerformanceBenchmark.js";

test("performance benchmark summarizes animation frame timing", async () => {
  const times = [10, 26, 42];
  const requestFrame = (callback) => callback(times.shift());
  const sample = await measureBenchmarkFrames(32, requestFrame);
  assert.equal(sample.avgFps, 62.5);
  assert.equal(sample.avgFrameMs, 16);
  assert.equal(sample.p95FrameMs, 16);
});
