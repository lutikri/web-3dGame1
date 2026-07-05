import test from "node:test";
import assert from "node:assert/strict";
import { createLevelOverrideSnapshot } from "../src/levels/LevelConfigSerialization.js";

test("saved level snapshots exclude registry-owned prefab fields", () => {
  const snapshot = createLevelOverrideSnapshot({
    schemaVersion: 1,
    assetPath: "room.glb",
    prefabs: [
      {
        name: "Door",
        prefabType: "bulkheadDoor",
        assetPath: "door.glb",
        materialKey: "door",
        behavior: "hingedDoor",
        interaction: { maxDistance: 2 },
        position: { x: 1, y: 2, z: 3 },
        light: { intensity: 2 },
      },
    ],
  });
  assert.equal(snapshot.assetPath, "room.glb");
  assert.deepEqual(snapshot.prefabs, [
    {
      name: "Door",
      position: { x: 1, y: 2, z: 3 },
      light: { intensity: 2 },
    },
  ]);
});
