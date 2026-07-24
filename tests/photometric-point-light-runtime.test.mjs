import assert from "node:assert/strict";
import test from "node:test";

import {
  advancePhotometricBlend,
  assignPhotometricProfileSlots,
  selectPhotometricLightEntries,
} from "../src/lighting/PhotometricPointLightRuntime.js";
import { getGraphicsQualityProfile } from "../src/config/GraphicsQualityProfiles.js";

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
  assert.equal(getGraphicsQualityProfile("low").photometricLightSlots, 1);
  assert.equal(getGraphicsQualityProfile("medium").photometricLightSlots, 2);
  assert.equal(getGraphicsQualityProfile("high").photometricLightSlots, 4);
});
