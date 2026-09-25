import test from "node:test";
import assert from "node:assert/strict";
import { createFusionCoreSimulation } from "../src/FusionCoreSimulation.js";

test("fusion core state can be checkpointed and restored", () => {
  const first = createFusionCoreSimulation();
  first.start();
  first.update(2, {
    fuelInjection: 40,
    magneticField: 60,
    coolantFlow: 30,
    ventActive: false,
    pulseActive: false,
  });
  const saved = first.exportState();
  const restored = createFusionCoreSimulation();
  assert.equal(restored.restoreState(saved), true);
  assert.deepEqual(restored.exportState(), saved);
});

test("fusion core does not advance its operating simulation during startup", () => {
  const core = createFusionCoreSimulation();
  core.start({ delaySeconds: 18 });
  assert.equal(core.getSnapshot().mode, "starting");
  core.update(17, {});
  assert.equal(core.getSnapshot().mode, "starting");
  assert.equal(core.getSnapshot().elapsed, 0);
  core.update(1, {});
  assert.equal(core.getSnapshot().mode, "running");
  assert.equal(core.getSnapshot().elapsed, 0);
  core.update(1, {
    fuelInjection: 40, magneticField: 60, coolantFlow: 30,
    ventActive: false, pulseActive: false,
  });
  assert.equal(core.getSnapshot().elapsed, 1);
});

test("fusion core debug outcome reaches a terminal state from any active attempt", () => {
  const passed = createFusionCoreSimulation();
  const passSnapshot = passed.forceOutcome("pass");
  assert.equal(passSnapshot.mode, "complete");
  assert.equal(passSnapshot.failureType, null);
  assert.equal(passSnapshot.debugForcedOutcome, "complete");
  assert.equal(passed.forceOutcome("fail"), null);

  const failed = createFusionCoreSimulation();
  failed.start({ delaySeconds: 18 });
  const failSnapshot = failed.forceOutcome("fail");
  assert.equal(failSnapshot.mode, "failed");
  assert.equal(failSnapshot.failureType, "qualityFailure");
  assert.equal(failSnapshot.debugForcedOutcome, "failed");
});
