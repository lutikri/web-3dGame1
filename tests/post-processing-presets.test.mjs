import assert from "node:assert/strict";
import test from "node:test";

import { applyGtaoPreset, applySsrPreset, createPostProcessingPresets } from "../src/postprocessing/PostProcessingPresets.js";

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
    updateGtaoMaterial: (value) => calls.push(value),
    updatePdMaterial: (value) => calls.push(value),
  };
  applyGtaoPreset(gtaoPass, { samples: 12, denoiseSamples: 6 });
  assert.equal(calls[0].samples, 12);
  assert.equal(calls[1].samples, 6);
  const ssrPass = {};
  applySsrPreset(ssrPass, { opacity: 0.6, blur: false });
  assert.equal(ssrPass.opacity, 0.6);
  assert.equal(ssrPass.blur, false);
});
