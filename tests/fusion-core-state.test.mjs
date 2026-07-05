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
