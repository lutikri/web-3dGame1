import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPrefabInstance, getPrefabDefinition } from "../src/prefabs/PrefabRegistry.js";
import { parsePrefabMarkerName, resolveNestedPrefabMarkers } from "../src/prefabs/PrefabMarkerResolver.js";

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

test("prefab marker shorthand supports legacy authored empty names", () => {
  assert.deepEqual(parsePrefabMarkerName("PF_Elevator1"), {
    prefabType: "Elevator1",
    instanceName: "Elevator1",
    stableName: "Elevator1",
  });
  assert.deepEqual(parsePrefabMarkerName("PF_ServiceDoor1"), {
    prefabType: "ServiceDoor1",
    instanceName: "ServiceDoor1",
    stableName: "ServiceDoor1",
  });
});

test("nested prefab markers resolve local to the parent prefab root", () => {
  const root = new THREE.Group();
  root.name = "Elevator1";
  root.position.set(10, 20, 30);
  const marker = new THREE.Object3D();
  marker.name = "PF_radio_CabinWall";
  marker.position.set(0.5, 1.25, -0.75);
  root.add(marker);

  const [nested] = resolveNestedPrefabMarkers(root, { parentName: "Elevator1" });
  assert.equal(nested.name, "Elevator1__radio_CabinWall");
  assert.equal(nested.prefabType, "radio");
  assert.deepEqual(nested.position.toArray(), [0.5, 1.25, -0.75]);
});
