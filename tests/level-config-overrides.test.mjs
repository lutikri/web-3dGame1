import test from "node:test";
import assert from "node:assert/strict";
import { applyLevelOverrides } from "../src/levels/LevelConfigOverrides.js";

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
