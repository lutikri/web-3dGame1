import test from "node:test";
import assert from "node:assert/strict";

import { PowerQualificationRuntime } from "../src/game/PowerQualificationRuntime.js";

const stages = [
  { name: "400 MW", targetMw: 400, toleranceMw: 40, holdSeconds: 10, narration: "power400" },
  { name: "950 MW", targetMw: 950, toleranceMw: 50, holdSeconds: 10, narration: "power950" },
  { name: "100 MW", targetMw: 100, toleranceMw: 20, holdSeconds: 10, narration: "power100" },
];

test("an early core start lets the control-booth narration finish before the 400 MW prompt", async () => {
  let narrationActive = true;
  const requested = [];
  const runtime = new PowerQualificationRuntime({
    isNarrationActive: () => narrationActive,
    playNarration: async (line) => {
      requested.push(line);
      return { soundKey: line };
    },
  });
  runtime.configure({ powerQualification: { stages } });

  runtime.onCoreStarted();
  await Promise.resolve();
  assert.deepEqual(requested, []);

  narrationActive = false;
  runtime.onNarrationEnded({ line: "panelTutorial" });
  await Promise.resolve();
  assert.deepEqual(requested, ["power400"]);
});

test("power qualification waits for each prompt, resets broken holds, and completes all stages", async () => {
  const requested = [];
  const runtime = new PowerQualificationRuntime({
    playNarration: async (line) => {
      requested.push(line);
      return { soundKey: line };
    },
    completeShift: () => ({ mode: "complete", powerOutput: 100, warning: {}, phase: {} }),
  });
  runtime.configure({ powerQualification: { stages } });

  assert.equal(runtime.onCoreStarted(), true);
  await Promise.resolve();
  assert.deepEqual(requested, ["power400"]);

  let snapshot = { mode: "running", powerOutput: 400, warning: {}, phase: {} };
  assert.equal(runtime.update(10, snapshot).mode, "running", "hold must not start before the prompt ends");
  runtime.onNarrationEnded({ line: "power400" });
  runtime.update(6, snapshot);
  runtime.update(1, { ...snapshot, powerOutput: 500 });
  snapshot = runtime.update(10, snapshot);
  await Promise.resolve();
  assert.equal(snapshot.targetOutput, 950);
  assert.deepEqual(requested, ["power400", "power950"]);

  runtime.onNarrationEnded({ line: "power950" });
  runtime.update(10, { ...snapshot, powerOutput: 950 });
  await Promise.resolve();
  assert.deepEqual(requested, ["power400", "power950", "power100"]);

  runtime.onNarrationEnded({ line: "power100" });
  snapshot = runtime.update(10, { ...snapshot, powerOutput: 100 });
  assert.equal(snapshot.mode, "complete");
  assert.equal(snapshot.qualification.passed, true);
  assert.equal(snapshot.qualification.passingPhases, 3);
});
