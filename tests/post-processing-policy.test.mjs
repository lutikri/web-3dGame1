import assert from "node:assert/strict";
import test from "node:test";

import { PostProcessingPolicy } from "../src/postprocessing/PostProcessingPolicy.js";

function createPolicy() {
  const shadowCalls = [];
  const light = { userData: { lightConfig: { castShadow: true } }, shadow: { map: { dispose() {} } } };
  const config = {
    shadows: { defaultQuality: "min", type: 2, presets: { min: {}, high: {} } },
    postProcessing: {
      gtao: { defaultQuality: "off", presets: { off: {}, high: {} } },
      ssgi: { defaultQuality: "off", presets: { off: {}, high: {} } },
      ssr: { defaultQuality: "off", presets: { off: {}, high: {} } },
      screenSpaceShadows: { defaultQuality: "off", presets: { off: {}, high: {} } },
      bloom: { strength: 1, radius: 0.2, threshold: 0.8 }, lut: { intensity: 0.5 },
      sharpen: { amount: 0.3 }, chromaticAberration: { amount: 0.01 },
      colorAdjustments: {}, lensDistortion: {}, lensEffects: {},
    },
  };
  const presets = {
    getShadow: (key) => ({ enabled: key === "high" }),
    getGtao: (key) => ({ enabled: key === "high" }),
    getSsgi: (key) => ({ enabled: key === "high" }),
    getSsr: (key) => ({ enabled: key === "high" }),
    getScreenSpaceShadows: (key) => ({ enabled: key === "high" }),
  };
  const policy = new PostProcessingPolicy({
    config,
    renderer: { shadowMap: { enabled: false, type: null } },
    presets,
    assets: { lensDirtTexture: null },
    pointLights: new Map([["main", light]]),
    prefabInstances: new Map(),
    applyShadowSettings: (...args) => shadowCalls.push(args),
    getTime: () => 4,
  });
  return { policy, shadowCalls };
}

test("post-processing policy owns quality state and effect rebuild decisions", () => {
  const { policy, shadowCalls } = createPolicy();
  let standardSetups = 0;
  let realismSetups = 0;
  policy.attach({
    runtime: { setup: () => standardSetups += 1, gtaoPass: null, ssrPass: null },
    realism: { setup: () => realismSetups += 1, ssgiEffect: null, screenSpaceShadowEffect: null },
  });

  assert.equal(policy.setGtaoQuality("high"), "high");
  assert.equal(policy.setSsgiQuality("high"), "high");
  assert.equal(policy.setShadowQuality("high"), "high");
  assert.deepEqual(policy.snapshot(), {
    shadows: "high", gtao: "high", ssgi: "high", ssr: "off", screenSpaceShadows: "off",
  });
  assert.equal(standardSetups, 2);
  assert.equal(realismSetups, 0);
  assert.equal(shadowCalls.length, 1);
});

test("post-processing policy applies live standard pass configuration", () => {
  const { policy } = createPolicy();
  const runtime = {
    bloomPass: {}, lutPass: {},
    sharpenPass: { uniforms: { amount: { value: 0 } } },
    chromaticAberrationPass: { uniforms: { amount: { value: 0 } } },
  };
  let realismUpdates = 0;
  policy.attach({ runtime, realism: { applyLiveConfig: () => realismUpdates += 1 } });
  policy.applyLiveConfig();
  assert.deepEqual(runtime.bloomPass, { strength: 1, radius: 0.2, threshold: 0.8 });
  assert.equal(runtime.lutPass.intensity, 0.5);
  assert.equal(runtime.sharpenPass.uniforms.amount.value, 0.3);
  assert.equal(realismUpdates, 1);
});

test("live AO tuning applies the active preset without rebuilding the composer", () => {
  const { policy } = createPolicy();
  const preset = {
    enabled: true, blendIntensity: 0.71, radius: 0.46, distanceExponent: 1.7,
    thickness: 0.8, distanceFallOff: 1, scale: 2, samples: 10,
    denoiseRadius: 2, denoiseSamples: 4, distanceFadeStart: 5, distanceFadeEnd: 12,
  };
  policy.presets.getGtao = (key) => key === "high" ? preset : { enabled: false };
  policy.replace({ gtao: "high" });
  const gtaoChanges = [];
  const denoiseChanges = [];
  const gtaoPass = {
    updateGtaoMaterial: (settings) => gtaoChanges.push(settings),
    updatePdMaterial: (settings) => denoiseChanges.push(settings),
    gtaoMaterial: { uniforms: { contactAoFadeStart: { value: 0 }, contactAoFadeEnd: { value: 0 } } },
  };
  policy.attach({ runtime: { gtaoPass, setup: () => assert.fail("Live AO must not rebuild the composer") }, realism: null });
  policy.applyLiveConfig();
  assert.equal(gtaoPass.blendIntensity, 0.71);
  assert.equal(gtaoChanges[0].radius, 0.46);
  assert.equal(gtaoChanges[0].samples, 10);
  assert.deepEqual(denoiseChanges[0], { radius: 2, samples: 4 });
  assert.equal(gtaoPass.gtaoMaterial.uniforms.contactAoFadeStart.value, 5);
  preset.blendIntensity = 0.2;
  preset.radius = 0.15;
  policy.applyLiveConfig();
  assert.equal(gtaoPass.blendIntensity, 0.2);
  assert.equal(gtaoChanges[1].radius, 0.15);
});

test("SSGI and standalone SSR are mutually exclusive", () => {
  const { policy } = createPolicy();
  let setups = 0;
  policy.attach({
    runtime: { setup: () => setups += 1, ssrPass: null },
    realism: { ssgiEffect: null },
  });

  policy.setSsgiQuality("high");
  policy.setSsrQuality("high");
  assert.equal(policy.snapshot().ssgi, "off");
  assert.equal(policy.snapshot().ssr, "high");
  assert.equal(setups, 2);
});

test("cinematic quality switches the realism bundle with one pipeline rebuild", () => {
  const { policy } = createPolicy();
  let setups = 0;
  policy.attach({
    runtime: { setup: () => setups += 1 },
    realism: { ssgiEffect: null, ssrEffect: null, screenSpaceShadowEffect: null },
  });

  assert.deepEqual(policy.setCinematicQuality("high"), {
    cinematic: "high",
    shadows: "min",
    gtao: "off",
    ssgi: "high",
    ssr: "off",
    screenSpaceShadows: "high",
  });
  assert.equal(setups, 1);
  assert.equal(policy.setCinematicQuality("invalid").cinematic, "off");
  assert.equal(setups, 2);
});
