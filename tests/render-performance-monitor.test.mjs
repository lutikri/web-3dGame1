import assert from "node:assert/strict";
import test from "node:test";

import {
  RenderPerformanceMonitor,
  summarizeDurations,
} from "../src/postprocessing/RenderPerformanceMonitor.js";

test("render timing summaries expose frame percentiles and worst time", () => {
  assert.deepEqual(summarizeDurations([4, 1, 3, 2, 10]), {
    samples: 5,
    avgMs: 4,
    p50Ms: 3,
    p95Ms: 10,
    p99Ms: 10,
    worstMs: 10,
  });
});

test("render monitor records CPU submission and renderer statistics without GPU queries", () => {
  const times = [10, 12.5];
  const monitor = new RenderPerformanceMonitor({
    renderer: {
      getContext: () => ({ getExtension: () => null }),
      info: { render: { calls: 42, triangles: 1234, points: 2, lines: 6 } },
    },
    now: () => times.shift(),
  });
  monitor.beginFrame();
  monitor.endFrame();
  assert.deepEqual(monitor.snapshot(), {
    cpu: { samples: 1, avgMs: 2.5, p50Ms: 2.5, p95Ms: 2.5, p99Ms: 2.5, worstMs: 2.5 },
    gpu: { available: false, samples: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, worstMs: 0 },
    render: { calls: 42, triangles: 1234, points: 2, lines: 6 },
  });
});
