import assert from "node:assert/strict";
import test from "node:test";

import { RealismPostProcessingRuntime } from "../src/postprocessing/RealismPostProcessingRuntime.js";

function createRuntime(enabled = false) {
  return new RealismPostProcessingRuntime({
    config: {
      postProcessing: {
        enabled,
        bloom: { enabled: true, strength: 0.4 },
        chromaticAberration: { enabled: true, amount: 0.01 },
      },
      feedback: { thermalEmergency: { bloomBoost: 0.5, chromaticBoost: 0.02 } },
    },
    renderer: {}, scene: {}, camera: {},
    presets: {
      getSsgi: () => ({ enabled: false }),
      getScreenSpaceShadows: () => ({ enabled: false }),
    },
    getQuality: () => ({ ssgi: "off", screenSpaceShadows: "off" }),
  });
}

test("realism runtime stays disabled when no realism quality is active", async () => {
  const runtime = createRuntime(true);
  assert.equal(runtime.isEnabled(), false);
  await runtime.setup();
  assert.deepEqual(runtime.inspect(), { realismComposer: false });
  assert.equal(runtime.render(0.016), false);
});

test("realism runtime owns live and emergency effect tuning", () => {
  const runtime = createRuntime(true);
  runtime.bloomEffect = { intensity: 0 };
  runtime.chromaticAberrationEffect = { offset: { set: (x, y) => { runtime.offset = [x, y]; } } };
  runtime.applyLiveConfig();
  assert.equal(runtime.bloomEffect.intensity, 0.4);
  runtime.applyEmergency(1, 0.5);
  assert.equal(runtime.bloomEffect.intensity, 0.9);
  assert.deepEqual(runtime.offset, [0.02, 0.02]);
});
