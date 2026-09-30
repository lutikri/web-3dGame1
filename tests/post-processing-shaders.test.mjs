import assert from "node:assert/strict";
import test from "node:test";

import {
  chromaticAberrationShader,
  colorAdjustmentShader,
  compatibleFxaaShader,
  lensEffectsShader,
  presentationShader,
  sharpenShader,
} from "../src/postprocessing/PostProcessingShaders.js";

test("post-processing shaders expose the uniforms required by the runtime", () => {
  assert.ok(chromaticAberrationShader.uniforms.amount);
  assert.ok(colorAdjustmentShader.uniforms.emergency);
  assert.ok(sharpenShader.uniforms.resolution);
  assert.ok(lensEffectsShader.uniforms.lensDirtTexture);
  assert.ok(lensEffectsShader.uniforms.bloomTexture);
  assert.match(lensEffectsShader.fragmentShader, /linearToDisplay\(linearBloom\)/);
  assert.ok(presentationShader.uniforms.sharpenAmount);
  assert.ok(presentationShader.uniforms.chromaticAberrationAmount);
  assert.ok(presentationShader.uniforms.bloomTexture);
  assert.match(presentationShader.fragmentShader, /distortUv\(vUv\)/);
});

test("compatible FXAA shader avoids unsupported loop bounds", () => {
  assert.equal(compatibleFxaaShader.name, "CompatibleFXAAShader");
  assert.equal(compatibleFxaaShader.fragmentShader.includes("-100.0"), false);
});
