import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  advancePhotometricBlend,
  assignPhotometricProfileSlots,
  selectPhotometricLightEntries,
} from "../src/lighting/PhotometricPointLightRuntime.js";
import { getGraphicsQualityProfile } from "../src/config/GraphicsQualityProfiles.js";
import {
  advancePoolBlend,
  createPointLightPoolRuntime,
  selectPointLightPoolEntries,
} from "../src/lighting/PointLightPoolRuntime.js";

test("photometric lights retain the profile assigned to each fixture type", () => {
  const fluorescentTexture = { name: "fluorescent" };
  const domeTexture = { name: "dome" };
  const { profiles, profileIndices } = assignPhotometricProfileSlots([
    { path: "fluorescent.hdr", texture: fluorescentTexture },
    { path: "dome.hdr", texture: domeTexture },
    { path: "dome.hdr", texture: domeTexture },
  ], 4);

  assert.deepEqual(profiles, [
    { path: "fluorescent.hdr", texture: fluorescentTexture },
    { path: "dome.hdr", texture: domeTexture },
  ]);
  assert.deepEqual(profileIndices, [0, 1, 1]);
});

test("photometric profile slots fail open when the texture-unit budget is exhausted", () => {
  const { profileIndices } = assignPhotometricProfileSlots([
    { path: "first.hdr", texture: {} },
    { path: "second.hdr", texture: {} },
  ], 1);

  assert.deepEqual(profileIndices, [0, -1]);
});

test("photometric light pool selects only the nearest fixtures inside its radius", () => {
  const entries = Array.from({ length: 6 }, (_, index) => ({ name: `light-${index}` }));
  const selected = selectPhotometricLightEntries([
    { entry: entries[0], distanceSq: 14 ** 2 },
    { entry: entries[1], distanceSq: 3 ** 2 },
    { entry: entries[2], distanceSq: 16 ** 2 },
    { entry: entries[3], distanceSq: 9 ** 2 },
    { entry: entries[4], distanceSq: 6 ** 2 },
    { entry: entries[5], distanceSq: 12 ** 2 },
  ], { maxLights: 4, radius: 15 });

  assert.deepEqual(selected, [entries[1], entries[4], entries[3], entries[5]]);
});

test("photometric light pool retains a selected fixture across the radius boundary", () => {
  const retained = { name: "retained" };
  const replacement = { name: "replacement" };
  const selected = selectPhotometricLightEntries([
    { entry: retained, distanceSq: 16 ** 2 },
    { entry: replacement, distanceSq: 14.5 ** 2 },
  ], {
    maxLights: 1,
    radius: 15,
    hysteresis: 2,
    selectedEntries: [retained],
  });

  assert.deepEqual(selected, [retained]);
  assert.deepEqual(selectPhotometricLightEntries([
    { entry: retained, distanceSq: 17.1 ** 2 },
    { entry: replacement, distanceSq: 14.5 ** 2 },
  ], {
    maxLights: 1,
    radius: 15,
    hysteresis: 2,
    selectedEntries: [retained],
  }), [replacement]);
});

test("photometric fixture strength fades in without changing shader slots", () => {
  assert.equal(advancePhotometricBlend(0, true, 0.15, 0.6), 0.25);
  assert.equal(advancePhotometricBlend(0.25, true, 0.45, 0.6), 1);
  assert.equal(advancePhotometricBlend(1, false, 0.3, 0.6), 0.5);
});

test("graphics quality selects the photometric shader slot budget before startup", () => {
  assert.equal(getGraphicsQualityProfile("low").pointLightSlots, 5);
  assert.equal(getGraphicsQualityProfile("medium").pointLightSlots, 8);
  assert.equal(getGraphicsQualityProfile("high").pointLightSlots, 12);
  assert.equal(getGraphicsQualityProfile("low").photometricLightSlots, 2);
  assert.equal(getGraphicsQualityProfile("medium").photometricLightSlots, 4);
  assert.equal(getGraphicsQualityProfile("high").photometricLightSlots, 6);
  assert.equal(getGraphicsQualityProfile("low").shadowQuality, "off");
  assert.equal(getGraphicsQualityProfile("medium").shadowQuality, "min");
  assert.equal(getGraphicsQualityProfile("high").shadowQuality, "med");
  assert.equal(getGraphicsQualityProfile("medium").gtaoQuality, "min");
  assert.equal(getGraphicsQualityProfile("medium").effects.includes("lensEffects"), true);
  assert.equal(getGraphicsQualityProfile("medium").maxRenderPixels, 1920 * 1080);
});

test("point light pool assigns fixture, simple, and off tiers by distance", () => {
  const near = { name: "near" };
  const mid = { name: "mid" };
  const far = { name: "far" };
  const selected = selectPointLightPoolEntries([
    { entry: far, distanceSq: 21 ** 2, hasFixture: true },
    { entry: mid, distanceSq: 14 ** 2, hasFixture: true },
    { entry: near, distanceSq: 6 ** 2, hasFixture: true },
  ], {
    maxLights: 3,
    maxFixtureLights: 1,
    fixtureRadius: 10,
    simpleRadius: 20,
  });

  assert.deepEqual(selected, [
    { entry: near, tier: "fixture" },
    { entry: mid, tier: "simple" },
  ]);
});

test("point light pool hysteresis retains tiers and fades new slots in", () => {
  const fixture = { name: "fixture" };
  assert.deepEqual(selectPointLightPoolEntries([
    { entry: fixture, distanceSq: 11.5 ** 2, hasFixture: true },
  ], {
    maxLights: 1,
    maxFixtureLights: 1,
    fixtureRadius: 10,
    simpleRadius: 20,
    hysteresis: 2,
    previousTiers: new Map([[fixture, "fixture"]]),
  }), [{ entry: fixture, tier: "fixture" }]);
  assert.equal(advancePoolBlend(0, true, 0.25, 0.5), 0.5);
});

test("lighting zones outrank distance and preactivate adjacent emitters without fixtures", () => {
  const active = { name: "active" };
  const adjacent = { name: "adjacent" };
  const outside = { name: "outside" };
  assert.deepEqual(selectPointLightPoolEntries([
    { entry: outside, distanceSq: 1, hasFixture: true, zoneTier: "off", priority: 2, zoneId: "Outside" },
    { entry: adjacent, distanceSq: 100, hasFixture: true, zoneTier: "simple", priority: 1, zoneId: "Next" },
    { entry: active, distanceSq: 144, hasFixture: true, zoneTier: "fixture", priority: 0, zoneId: "Here" },
  ], {
    maxLights: 2,
    maxFixtureLights: 1,
    fixtureRadius: 2,
    simpleRadius: 2,
  }), [
    { entry: active, tier: "fixture", zoneId: "Here" },
    { entry: adjacent, tier: "simple", zoneId: "Next" },
  ]);
});

test("point light runtime keeps authored emitters hidden and copies them into fixed slots", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 0);
  const root = new THREE.Group();
  scene.add(root);
  const source = new THREE.PointLight(0xff8800, 4, 12, 1.5);
  source.position.set(0, 0, 5);
  root.add(source);
  let assignment = null;
  const pool = createPointLightPoolRuntime({
    scene,
    camera,
    photometricLights: { setPooledAssignment: (...args) => { assignment = args; } },
    maxLights: 1,
    maxFixtureLights: 1,
    fixtureRadius: 10,
    simpleRadius: 20,
    transitionSeconds: 0,
  });
  const profile = {};
  const entry = pool.register({ root, light: source }, {}, profile);

  pool.update(1);

  const slot = scene.children.find((object) => object.userData.pointLightPoolSlot === 0);
  assert.equal(source.visible, false);
  assert.equal(slot.intensity, 4);
  assert.equal(slot.color.getHex(), 0xff8800);
  assert.deepEqual(slot.position.toArray(), [0, 0, 5]);
  assert.deepEqual(assignment, [profile, slot, 1]);
  pool.unregister(entry);
  assert.equal(slot.intensity, 0);
});
