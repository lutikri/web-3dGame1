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
