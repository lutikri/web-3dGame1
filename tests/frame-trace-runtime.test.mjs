import assert from "node:assert/strict";
import test from "node:test";

import { FrameTraceRuntime } from "../src/runtime/FrameTraceRuntime.js";

test("frame trace records hitch context and attributes work from the preceding frame", () => {
  let now = 0;
  let published = null;
  const saved = new Map();
  const runtime = new FrameTraceRuntime({
    now: () => now,
    getContext: () => ({ levelId: "exploring-around", textureLoading: { completedTextures: 4 } }),
    storage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
    log: () => {},
    onComplete: (trace) => { published = trace; },
  });

  runtime.start({ durationSeconds: 30, spikeThresholdMs: 18, warmupSeconds: 0 });
  runtime.beginFrame({ deltaSeconds: 0.01 });
  runtime.measureStep("physics", () => { now += 3; });
  runtime.measureStep("render-postprocessing", () => { now += 7; });
  runtime.endFrame();
  runtime.beginFrame({ deltaSeconds: 0.026 });
  runtime.endFrame();
  const trace = runtime.stop();

  assert.equal(trace.frames, 1);
  assert.equal(trace.spikes.length, 1);
  assert.equal(trace.spikes[0].frameMs, 26);
  assert.equal(trace.spikes[0].cpuMs, 10);
  assert.equal(trace.spikes[0].topSteps[0].label, "render-postprocessing");
  assert.equal(trace.spikes[0].context.levelId, "exploring-around");
  assert.deepEqual(JSON.parse(saved.get("operatorGame.frameTrace.v1")), trace);
  assert.equal(published, trace);
});

test("inactive frame trace does not execute diagnostic context collection", () => {
  let contextReads = 0;
  const runtime = new FrameTraceRuntime({ getContext: () => { contextReads += 1; return {}; } });
  assert.equal(runtime.beginFrame({ deltaSeconds: 1 }), false);
  assert.equal(contextReads, 0);
});
