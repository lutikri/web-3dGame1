import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLevelOverrides,
  applyPendingPrefabOverrides,
  applyPrefabStatePolicies,
} from "../src/levels/LevelConfigOverrides.js";

test("level overrides merge prefab instances by stable name", () => {
  const target = {
    prefabs: [
      {
        name: "Lamp",
        assetPath: "registry.glb",
        light: { intensity: 1, distance: 2 },
      },
    ],
  };
  applyLevelOverrides(target, {
    prefabs: [
      {
        name: "Lamp",
        assetPath: "wrong.glb",
        light: { intensity: 3 },
      },
    ],
  });
  assert.equal(target.prefabs[0].assetPath, "registry.glb");
  assert.deepEqual(target.prefabs[0].light, { intensity: 3, distance: 2 });
});

test("level overrides ignore unknown fields and unknown prefab names", () => {
  const target = { world: { fogNear: 1 }, prefabs: [] };
  applyLevelOverrides(target, {
    unknown: true,
    world: { unknown: true },
    prefabs: [{ name: "Missing", light: { intensity: 9 } }],
  });
  assert.deepEqual(target, { world: { fogNear: 1 }, prefabs: [] });
});

test("saved overrides apply when a prefab marker is discovered later", () => {
  const target = { prefabs: [] };
  applyLevelOverrides(target, {
    prefabs: [
      {
        name: "fluorescentLamp_PowerHall1",
        assetPath: "wrong.glb",
        light: { intensity: 4, castShadow: true },
      },
    ],
  });
  const markerPrefab = {
    name: "fluorescentLamp_PowerHall1",
    assetPath: "registry.glb",
    light: { intensity: 1, castShadow: false },
  };
  applyPendingPrefabOverrides([markerPrefab], target.prefabs);
  assert.equal(markerPrefab.assetPath, "registry.glb");
  assert.deepEqual(markerPrefab.light, { intensity: 4, castShadow: true });
});

test("level prefab state policies apply after saved marker overrides", () => {
  const prefabs = [
    { name: "DoorBulk1_A", prefabType: "bulkheadDoor", state: { latched: true } },
    { name: "DoorBulk1_4", prefabType: "DoorBulk1", state: { latched: false } },
    { name: "Door2_ServiceA", prefabType: "serviceDoor", state: { latched: false } },
  ];
  applyPrefabStatePolicies(prefabs, [{
    prefabTypes: ["bulkheadDoor", "DoorBulk1"],
    state: { latched: true },
    exceptions: { DoorBulk1_A: { latched: false } },
  }]);
  assert.equal(prefabs[0].state.latched, false);
  assert.equal(prefabs[1].state.latched, true);
  assert.equal(prefabs[2].state.latched, false);
});
