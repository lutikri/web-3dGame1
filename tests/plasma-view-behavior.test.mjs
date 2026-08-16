import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  createPlasmaViewRuntime,
  applyPlasmaViewConfig,
  updatePlasmaViewRuntime,
} from "../src/prefabs/behaviors/PlasmaViewBehavior.js";

function createFixture() {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 8, 24));
  core.name = "Torus.003";
  root.add(core);
  const runtime = createPlasmaViewRuntime(root, new Map([[core.name, core]]), {
    meshName: core.name,
    lightLocalOffset: [1, 2, 3],
  }, "Core1");
  return { root, core, runtime };
}

test("plasma view builds core, halo and a local reactor light from one authored torus", () => {
  const { root, core, runtime } = createFixture();
  assert.equal(runtime.core, core);
  assert.equal(runtime.halo.geometry, core.geometry);
  assert.equal(runtime.materials.length, 2);
  assert.deepEqual(runtime.light.position.toArray(), [1, 2, 3]);
  assert.equal(runtime.light.parent, root);
  assert.equal(core.material.name, "M_PlasmaView_Core");
  assert.equal(runtime.halo.material.name, "M_PlasmaView_Halo");
  assert.equal(runtime.uniforms.uFlowSpeed.value, 38);
  assert.equal(runtime.uniforms.uCoreGain.value, 1.15);
  assert.equal(runtime.uniforms.uHaloGain.value, 0.14);
  assert.equal(core.material.blending, THREE.NormalBlending);
  assert.equal(runtime.halo.material.blending, THREE.AdditiveBlending);
  assert.equal(core.material.side, THREE.DoubleSide);
  assert.equal(runtime.halo.material.side, THREE.DoubleSide);
});

test("plasma view applies artist-facing prefab tuning live", () => {
  const { runtime } = createFixture();
  applyPlasmaViewConfig(runtime, {
    flowSpeed: 3.2, coreOpacity: 0.24, haloScale: 1.12,
    baseFlowRatio: 0.08, baseStrength: 1.1, filamentDensity: 18,
    filamentSegmentation: 0.6, hotspotStrength: 1.8, hotspotThreshold: 0.65,
    colorVariation: 0.9, baseColor: 0x220044, stableColor: 0x33aaff,
    lightIntensity: 4.5, lightColor: 0xff22aa,
    lightLocalOffset: [4, 5, 6],
  });
  assert.equal(runtime.uniforms.uFlowSpeed.value, 3.2);
  assert.equal(runtime.uniforms.uCoreOpacity.value, 0.24);
  assert.equal(runtime.uniforms.uHotspotStrength.value, 1.8);
  assert.equal(runtime.uniforms.uFilamentDensity.value, 18);
  assert.equal(runtime.uniforms.uBaseFlowRatio.value, 0.08);
  assert.equal(runtime.uniforms.uBaseStrength.value, 1.1);
  assert.equal(runtime.uniforms.uFilamentSegmentation.value, 0.6);
  assert.equal(runtime.uniforms.uColorVariation.value, 0.9);
  assert.equal(runtime.uniforms.uBaseColor.value.getHex(), 0x220044);
  assert.equal(runtime.uniforms.uStableColor.value.getHex(), 0x33aaff);
  assert.equal(runtime.uniforms.uHotspotThreshold.value, 0.65);
  assert.equal(runtime.halo.scale.x, runtime.core.scale.x * 1.12);
  assert.equal(runtime.config.lightIntensity, 4.5);
  assert.equal(runtime.light.color.getHex(), 0xff22aa);
  assert.deepEqual(runtime.light.position.toArray(), [4, 5, 6]);
});

test("plasma shader derives activity, instability and pulse from the core snapshot", () => {
  const { runtime } = createFixture();
  const snapshot = {
    mode: "running",
    phase: { temp: [100, 135] },
    plasmaTemp: 168,
    containment: 38,
    burnRate: 0.92,
    powerOutput: 980,
    reactionEfficiency: 54,
    outputSurge: 72,
    coreStall: 64,
    shutdownLevel: 0,
    ignitionPulseCount: 1,
    fuelBlend: { efficiencyPenalty: 0.2 },
  };
  for (let index = 0; index < 90; index += 1) updatePlasmaViewRuntime(runtime, snapshot, 1 / 60);

  assert.ok(runtime.uniforms.uActivity.value > 0.7);
  assert.ok(runtime.uniforms.uInstability.value > 0.6);
  assert.ok(runtime.uniforms.uOverheat.value > 0.5);
  assert.ok(runtime.uniforms.uPulse.value > 0);
  assert.ok(runtime.light.intensity > 0);
  assert.equal(runtime.core.visible, true);
});

test("plasma view fades out after the reactor leaves running mode", () => {
  const { runtime } = createFixture();
  const running = {
    mode: "running", phase: { temp: [75, 105] }, plasmaTemp: 95, containment: 82,
    burnRate: 0.8, powerOutput: 500, reactionEfficiency: 80, outputSurge: 0,
    coreStall: 0, shutdownLevel: 0, ignitionPulseCount: 0, fuelBlend: {},
  };
  for (let index = 0; index < 90; index += 1) updatePlasmaViewRuntime(runtime, running, 1 / 60);
  const activeBrightness = runtime.light.intensity;
  for (let index = 0; index < 240; index += 1) {
    updatePlasmaViewRuntime(runtime, { ...running, mode: "complete", burnRate: 0, powerOutput: 0 }, 1 / 60);
  }
  assert.ok(runtime.light.intensity < activeBrightness * 0.03);
});
