import assert from "node:assert/strict";
import test from "node:test";
import { ShiftLifecycleRuntime } from "../src/game/ShiftLifecycleRuntime.js";

function createHarness(mode = "standby") {
  const calls = [];
  const snapshot = { mode };
  const runtime = new ShiftLifecycleRuntime({
    getSnapshot: () => snapshot,
    simulation: { getSnapshot: () => snapshot, start: () => calls.push("start"), reset: () => calls.push("reset"), triggerStartupFault: () => calls.push("fault") },
    fuelBlend: { start: () => calls.push("fuel-start"), stop: () => calls.push("fuel-stop") },
    completion: { reset: (value) => calls.push(`completion:${value}`) },
    diagnostics: { stopSelfTest: () => calls.push("self-stop"), startTimeline: () => calls.push("timeline-start"), stopTimeline: () => calls.push("timeline-stop"), startSelfTest: () => calls.push("self-start"), createSelfTestSnapshot: () => ({ mode: "test" }) },
    resetRecorder: () => calls.push("recorder"), hideResults: () => calls.push("results"), resetBulkhead: () => calls.push("bulkhead"), resetThoughts: () => calls.push("thoughts"),
    emitThought: (...args) => calls.push(["thought", ...args]), playIgnition: () => calls.push("ignition"), stopCoreLoop: () => calls.push("loop-stop"),
    triggerStartupFeedback: () => calls.push("feedback"), setStartupTimer: (v) => calls.push(["startup", v]), setIndicatorTimer: (v) => calls.push(["indicator", v]),
    updateStatus: (value) => calls.push(["status", value.mode]), log: () => {},
  });
  return { runtime, calls };
}

test("shift lifecycle runtime owns successful shift start", () => {
  const { runtime, calls } = createHarness();
  assert.equal(runtime.start(), true);
  assert.deepEqual(calls.slice(0, 8), ["recorder", "results", "bulkhead", "thoughts", "start", "fuel-start", "ignition", "completion:running"]);
  assert.ok(calls.includes("timeline-start"));
});

test("shift lifecycle runtime routes repeated start to startup fault", () => {
  const { runtime, calls } = createHarness("running");
  assert.equal(runtime.start(), false);
  assert.deepEqual(calls, ["fault", ["thought", "startup-command-fault", 4, 3.6]]);
});

test("shift lifecycle runtime resets core and presentation state", () => {
  const { runtime, calls } = createHarness("running");
  assert.equal(runtime.reset(), true);
  assert.ok(calls.includes("reset"));
  assert.ok(calls.includes("completion:standby"));
  assert.ok(calls.includes("timeline-stop"));
});
