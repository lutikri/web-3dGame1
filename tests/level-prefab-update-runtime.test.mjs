import assert from "node:assert/strict";
import test from "node:test";

import { LevelPrefabUpdateRuntime } from "../src/prefabs/LevelPrefabUpdateRuntime.js";

test("level prefab update runtime owns light intensity and emissive feedback", () => {
  const emissive = { emissiveIntensity: 0, userData: { baseEmissiveIntensity: 2 } };
  const darkFixture = { emissiveIntensity: 1, userData: { baseEmissiveIntensity: 0 } };
  const placed = {
    light: { intensity: 0, visible: false },
    startupElapsed: 0,
    afterglowRemaining: 0,
    faultyStarterElapsed: 0,
    flickerTime: 0,
    fixtureFlicker: {},
    startupPattern: [],
    emissiveMaterials: [emissive, darkFixture],
  };
  const runtime = new LevelPrefabUpdateRuntime({
    config: {
      feedback: { roomLightSwitch: {} },
      interior: { specialMaterials: {} },
      levelEnvironments: {
        room: { prefabs: [{ name: "Lamp", materialKey: "lamp", light: { enabled: true, intensity: 4 } }] },
      },
    },
    instances: new Map([["room:Lamp", placed]]),
    getTime: () => 0,
    getStarterFaultFactor: () => 1,
    updateFlicker: () => {},
    getFlickerFactor: () => 1,
    getStartupDuration: () => 0,
    getStartupFactor: () => 1,
    getRoomLightVisualFactor: () => 1,
    getRoomLightAfterglowFactor: () => 0,
    getSceneLightFactor: () => 0.5,
  });

  runtime.updateLights(0.1);

  assert.equal(placed.light.visible, true);
  assert.equal(placed.light.intensity, 2);
  assert.equal(emissive.emissiveIntensity, 1);
  assert.equal(darkFixture.emissiveIntensity, 0);
});
