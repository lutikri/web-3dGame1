import test from "node:test";
import assert from "node:assert/strict";
import { createPrefabInstance, getPrefabDefinition } from "../src/prefabs/PrefabRegistry.js";

test("prefab instances clone registry-owned nested defaults", () => {
  const first = createPrefabInstance("fluorescentLamp", { name: "First" });
  const second = createPrefabInstance("fluorescentLamp", { name: "Second" });
  first.light.flicker.enabled = true;
  first.position.x = 9;
  assert.equal(second.light.flicker.enabled, false);
  assert.equal(second.position.x, 0);
});

test("unknown override fields cannot extend a prefab definition", () => {
  const instance = createPrefabInstance("bulkheadDoor", {
    name: "Door",
    overrides: {
      assetPath: "wrong.glb",
      unknownRuntimeHook: "nope",
      interaction: { maxDistance: 4 },
    },
  });
  assert.equal(instance.assetPath, getPrefabDefinition("bulkheadDoor").assetPath);
  assert.equal(instance.unknownRuntimeHook, undefined);
  assert.equal(instance.interaction.maxDistance, getPrefabDefinition("bulkheadDoor").interaction.maxDistance);
});
