import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneSerializable,
  createLevelOverrideSnapshot,
} from "../src/levels/LevelConfigSerialization.js";

test("optional config sections may be undefined", () => {
  assert.equal(cloneSerializable(undefined), undefined);
  assert.deepEqual(cloneSerializable({ shadows: true, optional: undefined }), { shadows: true });
});

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
        elevator: { travelDurationSeconds: 1 },
        interaction: { maxDistance: 2 },
        radio: { maxDistance: 3 },
        position: { x: 1, y: 2, z: 3 },
        light: { intensity: 2, castShadow: true },
      },
    ],
  });
  assert.equal(snapshot.assetPath, "room.glb");
  assert.deepEqual(snapshot.prefabs, [
    {
      name: "Door",
      position: { x: 1, y: 2, z: 3 },
      light: { intensity: 2, castShadow: true },
    },
  ]);
});
