import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDebugPrefabs,
  createDebugProjectSavePayload,
  getCoreViewportDebugProperties,
  getAudioSearchCandidates,
  getOperatorPanelScreenDebugProperties,
  getStatusViewportDebugProperties,
  getSuspendedLampDebugProperties,
  getPlasmaViewDebugProperties,
  parseDebugWorkspaceSelection,
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

test("debug workspace exposes operator panel status screen tuning", () => {
  const screen = { brightness: 1.4, persistenceDecay: 0.26 };
  assert.equal(getOperatorPanelScreenDebugProperties({ behavior: "operatorPanel", screen }), screen);
  assert.equal(getOperatorPanelScreenDebugProperties({ behavior: "radio", screen }), null);
});

test("debug workspace exposes master status viewport tuning", () => {
  const statusViewport = { updateIntervalSeconds: 1, indicators: { Efficiency: { intensity: 2 } } };
  assert.equal(getStatusViewportDebugProperties({ behavior: "statusViewport", statusViewport }), statusViewport);
  assert.equal(getStatusViewportDebugProperties({ behavior: "radio", statusViewport }), null);
});

test("debug workspace exposes live core viewport shutter tuning", () => {
  const coreViewport = { closedPosition: 0.000028, openPosition: 0.226287, travelDurationSeconds: 10 };
  assert.equal(getCoreViewportDebugProperties({ behavior: "coreViewport", coreViewport }), coreViewport);
  assert.equal(getCoreViewportDebugProperties({ behavior: "radio", coreViewport }), null);
});

test("debug workspace resolves a material selection to its material key", () => {
  assert.deepEqual(parseDebugWorkspaceSelection("material:terminalScreenGlass"), {
    kind: "material",
    key: "terminalScreenGlass",
  });
  assert.deepEqual(parseDebugWorkspaceSelection("prefab:exploring-around:Desk1_1"), {
    kind: "prefab",
    levelId: "exploring-around",
    key: "Desk1_1",
  });
});

test("audio workspace searches the full registry by sound name and category path", () => {
  const registry = {
    Menu_Click1: { path: "assets/sounds/ui/Menu_Click1.ogg" },
    DoorBulk1_Open1: { path: "assets/sounds/interaction/DoorBulk1_Open1.ogg" },
  };
  assert.deepEqual(getAudioSearchCandidates("UI click", new Set(), registry), ["Menu_Click1"]);
  assert.deepEqual(getAudioSearchCandidates("", new Set(["DoorBulk1_Open1"]), registry), ["DoorBulk1_Open1"]);
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
      metal: { color: "#ffffff", roughness: 0.5, opacity: 0.35, assetPath: "ignored.png" },
    },
    globalLightingConfig: { ambientIntensity: 0.2 },
    decalConfig: { opacity: 0.8 },
    cameraConfig: { walkSpeed: 1.65, operatorMovement: { bodyRig: { heldMassScale: 1.45 } } },
    postProcessingConfig: { enabled: true },
    soundRegistry: {
      hum: { path: "ignored.ogg", loop: true, volume: 0.2, refDistance: 0.5 },
    },
    soundMix: { master: 1, machinery: 0.8 },
  });

  assert.equal(payload.kind, "allConfigs");
  assert.equal(payload.config.room.id, "room");
  assert.deepEqual(payload.config.globalScene, {
    materials: { metal: { color: "#ffffff", roughness: 0.5, opacity: 0.35 } },
    lighting: { ambientIntensity: 0.2 },
    camera: { walkSpeed: 1.65, operatorMovement: { bodyRig: { heldMassScale: 1.45 } } },
    decals: { opacity: 0.8 },
  });
  assert.deepEqual(payload.config.postProcessing, { enabled: true });
  assert.deepEqual(payload.config.audio, {
    mix: { master: 1, machinery: 0.8 },
    sounds: { hum: { volume: 0.2, refDistance: 0.5 } },
  });
});
