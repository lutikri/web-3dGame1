import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDebugPrefabs,
  createDebugProjectSavePayload,
  getSuspendedLampDebugProperties,
} from "../src/ui/debug/workspace/DebugWorkspace.js";

test("debug workspace exposes suspended lamp config and shared bulb material", () => {
  const suspension = { maxAngleDegrees: 4 };
  const bulbMaterial = { emissiveIntensity: 8 };
  assert.deepEqual(getSuspendedLampDebugProperties(
    { behavior: "suspendedLamp", suspension },
    { lampDome1Bulb: bulbMaterial },
  ), { suspension, bulbMaterial });
  assert.equal(getSuspendedLampDebugProperties({ behavior: "radio" }, {}), null);
});

test("debug workspace groups Blender bulkhead aliases and uses natural name order", () => {
  const prefabs = [
    { prefabType: "DoorBulk1", name: "DoorBulk1_10" },
    { prefabType: "serviceDoor", name: "ServiceDoor_1" },
    { prefabType: "bulkheadDoor", name: "DoorBulk1_2" },
  ];
  assert.deepEqual(prefabs.sort(compareDebugPrefabs).map(({ name }) => name), [
    "ServiceDoor_1",
    "DoorBulk1_2",
    "DoorBulk1_10",
  ]);
});

test("debug workspace project save batches level, materials, and post processing", () => {
  const payload = createDebugProjectSavePayload({
    environment: {
      id: "room",
      saveKind: "room",
      prefabs: [],
      lighting: {},
      world: {},
      player: {},
    },
    materialConfigs: {
      metal: { color: "#ffffff", roughness: 0.5, assetPath: "ignored.png" },
    },
    globalLightingConfig: { ambientIntensity: 0.2 },
    decalConfig: { opacity: 0.8 },
    postProcessingConfig: { enabled: true },
  });

  assert.equal(payload.kind, "allConfigs");
  assert.equal(payload.config.room.id, "room");
  assert.deepEqual(payload.config.globalScene, {
    materials: { metal: { color: "#ffffff", roughness: 0.5 } },
    lighting: { ambientIntensity: 0.2 },
    decals: { opacity: 0.8 },
  });
  assert.deepEqual(payload.config.postProcessing, { enabled: true });
});
