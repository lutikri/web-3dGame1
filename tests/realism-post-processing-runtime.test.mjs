import assert from "node:assert/strict";
import test from "node:test";

import {
  createFramebufferCopyCompatibilityWrapper,
  RealismPostProcessingRuntime,
  resolveRealismEffectSelection,
} from "../src/postprocessing/RealismPostProcessingRuntime.js";

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
      getSsr: () => ({ enabled: false }),
      getScreenSpaceShadows: () => ({ enabled: false }),
    },
    getQuality: () => ({ ssgi: "off", ssr: "off", screenSpaceShadows: "off" }),
  });
}

test("realism runtime stays disabled when no realism quality is active", async () => {
  const runtime = createRuntime(true);
  assert.equal(runtime.isEnabled(), false);
  await runtime.setup();
  assert.deepEqual(runtime.inspect(), { realismComposer: false });
  assert.equal(runtime.render(0.016), false);
});

test("framebuffer copy compatibility accepts current and legacy Three signatures", () => {
  const renderer = {};
  const calls = [];
  const copy = createFramebufferCopyCompatibilityWrapper(renderer, function (...args) {
    calls.push({ receiver: this, args });
  });
  const texture = { isTexture: true };
  const position = { x: 2, y: 3 };

  copy(texture, position, 1);
  copy(position, texture, 2);

  assert.deepEqual(calls, [
    { receiver: renderer, args: [texture, position, 1] },
    { receiver: renderer, args: [texture, position, 2] },
  ]);
});

test("cinematic effect selection avoids layering SSR over full SSGI", () => {
  assert.deepEqual(resolveRealismEffectSelection({ ssgi: true, screenSpaceShadows: true }), {
    ssgi: true,
    hbao: true,
  });
  assert.deepEqual(resolveRealismEffectSelection(), {
    ssgi: false,
    hbao: false,
  });
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
