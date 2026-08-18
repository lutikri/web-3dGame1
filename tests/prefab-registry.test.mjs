import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPrefabInstance, getPrefabDefinition } from "../src/prefabs/PrefabRegistry.js";
import { parsePrefabMarkerName, resolveNestedPrefabMarkers } from "../src/prefabs/PrefabMarkerResolver.js";

test("plasma view marker resolves to the authored torus prefab and reactor behavior", () => {
  const plasma = createPrefabInstance("plasmaView", { name: "Core1" });
  assert.equal(plasma.assetPath, "assets/mesh/prefabs/PF_plasmaView_Core1.glb");
  assert.equal(plasma.behavior, "plasmaView");
  assert.equal(plasma.plasma.meshName, "Torus.003");
  assert.equal(plasma.plasma.flowSpeed, 38);
  assert.equal(plasma.plasma.baseFlowRatio, 0.055);
  assert.equal(plasma.plasma.baseStrength, 0.8);
  assert.equal(plasma.plasma.coreGain, 1.15);
  assert.equal(plasma.plasma.haloGain, 0.14);
  assert.equal(plasma.plasma.coreOpacity, 0.52);
  assert.equal(plasma.plasma.colorVariation, 0.72);
  assert.equal(plasma.plasma.stableColor, 0x3978d8);
  assert.deepEqual(parsePrefabMarkerName("PF_plasmaView_Core1"), {
    prefabType: "plasmaView",
    instanceName: "Core1",
  });
});

test("master status viewport marker resolves to the reusable panel behavior", () => {
  const panel = createPrefabInstance("PanelStatusViewport1", { name: "PanelStatusViewport1" });
  assert.equal(panel.assetPath, "assets/mesh/prefabs/SM_PanelStatusViewport1.glb");
  assert.equal(panel.behavior, "statusViewport");
  assert.equal(panel.materialKey, "panelStatusView1");
  assert.equal(panel.statusViewport.screenMeshName, "SM_PanelViewStatus1_Screen");
  assert.equal(panel.statusViewport.updateIntervalSeconds, 1);
  assert.deepEqual(parsePrefabMarkerName("PF_PanelStatusViewport1_PanelStatusViewport1"), {
    prefabType: "PanelStatusViewport1",
    instanceName: "PanelStatusViewport1",
  });
});

test("flashlight marker resolves to a portable physical equipment item", () => {
  const flashlight = createPrefabInstance("FlashLight", { name: "FlashLight1" });
  assert.equal(flashlight.assetPath, "assets/mesh/prefabs/SM_Flashligh1.glb");
  assert.equal(flashlight.behavior, "staticProp");
  assert.equal(flashlight.name, "FlashLight1");
  assert.equal(flashlight.light.type, "spot");
  assert.equal(flashlight.light.markerName, "Spot");
  assert.equal(flashlight.light.itemControlled, true);
  assert.equal(flashlight.light.castShadow, false);
  assert.equal(flashlight.light.shadowNear, 0.01);
  assert.equal(flashlight.light.cookiePath,
    "assets/runtime-textures/T_FlashLight1_Cookie_1024_ETC1S.ktx2");
  assert.equal(flashlight.interaction, undefined);
  assert.equal(flashlight.rigidBody.bodyType, "dynamic");
  assert.deepEqual(flashlight.rigidBody.colliderNamePrefixes, ["UBX_SM_FlashLightBody1"]);
  assert.equal(flashlight.item.portable, true);
  assert.equal(flashlight.item.activationType, "toggleLight");
  assert.equal(flashlight.item.defaultOn, false);
  assert.deepEqual(flashlight.item.rotationOffset, [0, 270, 0]);
  assert.equal(flashlight.item.grabDistance, 0.82);
  assert.deepEqual(flashlight.item.grabOffset, [0, -0.22, 0]);
});

test("prefab instances clone registry-owned nested defaults", () => {
  const first = createPrefabInstance("fluorescentLamp", { name: "First" });
  const second = createPrefabInstance("fluorescentLamp", { name: "Second" });
  first.light.flicker.enabled = true;
  first.position.x = 9;
  assert.equal(second.light.flicker.enabled, false);
  assert.equal(second.position.x, 0);
});

test("operator panel owns independent status screen effect defaults", () => {
  const first = createPrefabInstance("operatorPanel", { name: "FirstPanel" });
  const second = createPrefabInstance("operatorPanel", { name: "SecondPanel" });
  first.screen.brightness = 2;
  assert.equal(second.screen.brightness, 1.4);
  assert.equal(second.screen.persistenceDecay, 0.26);
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
  assert.equal(lamp.light.enabled, true);
  assert.equal(lamp.item.enabled, true);
  assert.equal(lamp.item.portable, false);
  assert.equal(lamp.rigidBody.bodyType, "dynamic");
});

test("desk owns three physical drawers and excludes their colliders from the desk body", () => {
  const desk = getPrefabDefinition("Desk1");
  assert.equal(desk.behavior, "deskDrawers");
  assert.deepEqual(desk.drawers.drawerNames, [
    "SM_Desk_Drawer1",
    "SM_Desk_Drawer2",
    "SM_Desk_Drawer3",
  ]);
  assert.equal(desk.drawers.closedPosition, 0.18349);
  assert.equal(desk.drawers.openPosition, 0.632626);
  assert.deepEqual(desk.drawers.axis, [0, 0, -1]);
  assert.deepEqual(desk.rigidBody.colliderNamePrefixes, ["UBX_SM_Desk1_"]);
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
