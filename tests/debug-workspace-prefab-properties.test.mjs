import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDebugPrefabs,
  createDebugProjectSavePayload,
  getSuspendedLampDebugProperties,
  getPlasmaViewDebugProperties,
} from "../src/ui/debug/workspace/DebugWorkspace.js";
import {
  isSocketGeneratedPrefab,
  registerPrefabPlacement,
} from "../src/prefabs/PrefabPlacementMetadata.js";

test("socket-generated brief prefabs can be omitted from the authored prefab outliner", () => {
  const prefab = {};
  registerPrefabPlacement(prefab, { source: "socket", markerName: "SOCKET_Brief_01" });
  assert.equal(isSocketGeneratedPrefab(prefab), true);
  assert.equal(isSocketGeneratedPrefab({}), false);
});

test("debug workspace exposes suspended lamp config and shared bulb material", () => {
  const suspension = { maxAngleDegrees: 4 };
  const bulbMaterial = { emissiveIntensity: 8 };
  assert.deepEqual(getSuspendedLampDebugProperties(
    { behavior: "suspendedLamp", suspension },
    { lampDome1Bulb: bulbMaterial },
  ), { suspension, bulbMaterial });
  assert.equal(getSuspendedLampDebugProperties({ behavior: "radio" }, {}), null);
});

test("debug workspace exposes live plasma prefab tuning", () => {
  const plasma = {
    flowSpeed: 38, baseStrength: 0.8, coreOpacity: 0.52,
    filamentDensity: 14, hotspotStrength: 2.4, colorVariation: 0.72,
    stableColor: 0x3978d8,
  };
  assert.equal(getPlasmaViewDebugProperties({ behavior: "plasmaView", plasma }), plasma);
  assert.equal(getPlasmaViewDebugProperties({ behavior: "radio", plasma }), null);
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
    cameraConfig: { walkSpeed: 1.65, operatorMovement: { bodyRig: { heldMassScale: 1.45 } } },
    postProcessingConfig: { enabled: true },
  });

  assert.equal(payload.kind, "allConfigs");
  assert.equal(payload.config.room.id, "room");
  assert.deepEqual(payload.config.globalScene, {
    materials: { metal: { color: "#ffffff", roughness: 0.5 } },
    lighting: { ambientIntensity: 0.2 },
    camera: { walkSpeed: 1.65, operatorMovement: { bodyRig: { heldMassScale: 1.45 } } },
    decals: { opacity: 0.8 },
  });
  assert.deepEqual(payload.config.postProcessing, { enabled: true });
});
