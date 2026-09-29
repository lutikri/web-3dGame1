import assert from "node:assert/strict";
import test from "node:test";

import { applyGtaoPreset, createPostProcessingPresets } from "../src/postprocessing/PostProcessingPresets.js";

test("post-processing preset policy falls back to off presets", () => {
  const off = { enabled: false, marker: "off" };
  const presets = createPostProcessingPresets({
    config: {
      shadows: { presets: { min: { enabled: true } } },
      postProcessing: {
        gtao: { presets: { off } }, ssgi: { presets: { off } },
        ssr: { presets: { off } }, screenSpaceShadows: { presets: { off } },
      },
    },
  });
  assert.equal(presets.getGtao("missing"), off);
  assert.equal(presets.getSsr("missing"), off);
  assert.equal(presets.getShadow("missing").enabled, true);
});

test("post-processing preset applicators configure pass APIs", () => {
  const calls = [];
  const gtaoPass = {
    gtaoMaterial: {
      uniforms: {
        contactAoFadeStart: { value: 0 },
        contactAoFadeEnd: { value: 0 },
      },
    },
    updateGtaoMaterial: (value) => calls.push(value),
    updatePdMaterial: (value) => calls.push(value),
  };
  applyGtaoPreset(gtaoPass, {
    samples: 12,
    denoiseSamples: 6,
    distanceFadeStart: 7,
    distanceFadeEnd: 11,
  });
  assert.equal(calls[0].samples, 12);
  assert.equal(calls[1].samples, 6);
  assert.equal(gtaoPass.gtaoMaterial.uniforms.contactAoFadeStart.value, 7);
  assert.equal(gtaoPass.gtaoMaterial.uniforms.contactAoFadeEnd.value, 11);
});
