import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPrefabInstance, getPrefabDefinition } from "../src/prefabs/PrefabRegistry.js";
import { parsePrefabMarkerName, resolveNestedPrefabMarkers } from "../src/prefabs/PrefabMarkerResolver.js";

test("flashlight marker resolves to a portable physical equipment item", () => {
  const flashlight = createPrefabInstance("FlashLight", { name: "FlashLight1" });
  assert.equal(flashlight.assetPath, "assets/mesh/prefabs/SM_Flashligh1.glb");
  assert.equal(flashlight.behavior, "staticProp");
  assert.equal(flashlight.name, "FlashLight1");
  assert.equal(flashlight.light, undefined);
  assert.equal(flashlight.interaction, undefined);
  assert.equal(flashlight.rigidBody.bodyType, "dynamic");
  assert.deepEqual(flashlight.rigidBody.colliderNamePrefixes, ["UBX_SM_FlashLightBody1"]);
  assert.equal(flashlight.item.portable, true);
  assert.equal(flashlight.item.activationType, "toggleLight");
});

test("prefab instances clone registry-owned nested defaults", () => {
  const first = createPrefabInstance("fluorescentLamp", { name: "First" });
  const second = createPrefabInstance("fluorescentLamp", { name: "Second" });
  first.light.flicker.enabled = true;
  first.position.x = 9;
  assert.equal(second.light.flicker.enabled, false);
  assert.equal(second.position.x, 0);
});

test("service door registry uses the current authored GLB", () => {
  assert.equal(getPrefabDefinition("serviceDoor").assetPath, "assets/mesh/prefabs/SM_Door2.glb");
});

test("dome lamp owns its bulb material, zero-offset point light, and runtime photometric profile", () => {
  const lamp = createPrefabInstance("LampDome1", {
    name: "HallLamp",
    overrides: { suspension: { maxAngleDegrees: 5 } },
  });
  assert.equal(lamp.assetPath, "assets/mesh/prefabs/SM_LampDome1.glb");
  assert.equal(lamp.materialKey, "controlPost1");
  assert.equal(lamp.behavior, "suspendedLamp");
  assert.equal(lamp.suspension.pivotName, "PIVOT_LampDome1_Suspension");
  assert.equal(lamp.suspension.maxAngleDegrees, 5);
  assert.equal(lamp.materialOverrides.SM_LampDome1_Bulb, "lampDome1Bulb");
  assert.equal(lamp.light.parentName, "SM_LampDome1");
  assert.deepEqual(lamp.light.localOffset.toArray(), [0, 0, 0]);
  assert.equal(lamp.light.photometricProfile.path,
    "assets/runtime-textures/T_LampDome1_LightDistribution_1024_RGBE.hdr");
  assert.equal(lamp.light.photometricProfile.flipY, true);
});

test("desk lamp owns its emissive bulb override and authored spotlight marker", () => {
  const lamp = createPrefabInstance("LampDesk1", { name: "DeskLamp" });
  assert.equal(lamp.materialOverrides.SM_LampDesk1_Bulb, "lampDesk1Bulb");
  assert.equal(lamp.light.markerName, "LGT_DeskLamp1");
});

test("analog clock owns a reusable positional loop definition", () => {
  const clock = createPrefabInstance("analogClock", { name: "HallClock" });
  assert.equal(clock.audio.loopSoundKey, "Clock1_loop");
  assert.equal(clock.audio.maxDistance, 2.4);
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

test("authored bulkhead marker alias reuses the shared door behavior", () => {
  assert.deepEqual(parsePrefabMarkerName("PF_DoorBulk1_4"), {
    prefabType: "DoorBulk1",
    instanceName: "4",
  });
  assert.deepEqual(getPrefabDefinition("DoorBulk1"), getPrefabDefinition("bulkheadDoor"));
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
