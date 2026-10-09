import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createPrefabInstance } from "../src/prefabs/PrefabRegistry.js";
import { parsePrefabMarkerName } from "../src/prefabs/PrefabMarkerResolver.js";
import { createLevelOverrideSnapshot } from "../src/levels/LevelConfigSerialization.js";
import { applyPrefabOverrideEntries, applyPrefabStatePolicies } from "../src/levels/LevelConfigOverrides.js";
import { LEVEL_EXPLORING_AROUND_CONFIG } from "../src/levels/LevelExploringAroundConfig.js";
import { LevelBindingRuntime } from "../src/levels/LevelBindingRuntime.js";
import { createLevelSceneBuilder } from "../src/scene/LevelSceneBuilder.js";
import { getLightPanelDebugProperties } from "../src/ui/debug/workspace/DebugWorkspace.js";
import {
  activateLightPanelControl, applyLightPanelConfig, createLightPanelRuntime,
  registerLightPanelInteraction, syncLightPanelPower, updateLightPanelRuntime,
} from "../src/prefabs/behaviors/LightPanelBehavior.js";

async function fixture({ tripped = false } = {}) {
  const bytes = readFileSync(new URL("../assets/mesh/prefabs/PF_LightPanel1.glb", import.meta.url));
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const prefab = createPrefabInstance("LightPanel1", { name: "LightPanel1_Main" });
  applyPrefabStatePolicies([prefab], LEVEL_EXPLORING_AROUND_CONFIG.prefabStatePolicies);
  prefab.lightPanel.startsTripped = tripped;
  const parts = new Map();
  // Read authored transforms directly. Draco geometry loading is covered by
  // the browser; these unit tests exercise interaction and motion ownership.
  gltf.nodes.forEach((node) => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    object.name = node.name;
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    parts.set(object.name, object);
  });
  const panel = createLightPanelRuntime(parts, prefab.lightPanel, prefab.name);
  const instances = new Map([["room:LightPanel1_Main", { lightPanel: panel }]]);
  const interactive = [];
  registerLightPanelInteraction("room", prefab, { lightPanel: panel }, interactive);
  return { prefab, parts, panel, instances, interactive, gltf };
}

test("authored LightPanel GLB declares independent controls, UVs, normals and the runtime marker type", async () => {
  const { gltf, interactive } = await fixture();
  assert.equal(interactive.length, 8);
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_0), `${mesh.name}: missing UVs`);
      assert.ok(Number.isInteger(primitive.attributes.NORMAL), `${mesh.name}: missing normals`);
    }
  }
  assert.deepEqual(parsePrefabMarkerName("PF_LightPanel1_Main"), { prefabType: "LightPanel1", instanceName: "Main" });
  assert.equal(parsePrefabMarkerName("PF_LightPanel1").stableName, "LightPanel1");
});

test("door closes the exported +90 degree pose and opens 120 degrees about converted Blender Z", async () => {
  const { panel, parts, instances } = await fixture();
  const door = parts.get("SM_Lightpanel1_Door1");
  assert.ok(door.quaternion.angleTo(new THREE.Quaternion()) < 0.000001);
  activateLightPanelControl(door, instances);
  updateLightPanelRuntime(panel, panel.config.doorDurationSeconds);
  const open = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(120));
  assert.ok(door.quaternion.angleTo(open) < 0.000001);
  activateLightPanelControl(door, instances);
  updateLightPanelRuntime(panel, 2);
  assert.ok(door.quaternion.angleTo(new THREE.Quaternion()) < 0.000001);
});

test("breaker rotation uses parent X rather than the rotated exported local X; isolator travels on Y", async () => {
  const { panel, parts, instances } = await fixture();
  const mesh = parts.get("LightPanel1_Switch_ControlBooth");
  const exported = mesh.quaternion.clone();
  activateLightPanelControl(mesh, instances);
  updateLightPanelRuntime(panel, 1);
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(35)).multiply(exported);
  assert.ok(mesh.quaternion.angleTo(expected) < 0.000001);
  const master = parts.get("LightPanel1_SwitchIsolator1");
  const lateral = [master.position.x, master.position.z];
  assert.equal(master.position.y, 0.11769);
  activateLightPanelControl(master, instances);
  updateLightPanelRuntime(panel, 1);
  assert.equal(master.position.y, 0.057102);
  assert.deepEqual([master.position.x, master.position.z], lateral);
});

test("room circuits and master cycle use the light API, recover starters and remain level-owned", async () => {
  const { panel, parts, instances } = await fixture();
  const targets = Object.values(panel.config.circuits).flatMap((circuit) => [circuit.targets, circuit.extraTargets].join(",").split(",").map((name) => name.trim()).filter(Boolean));
  const prefabs = [...targets, "unrelated"].map((name) => ({ name, light: { enabled: true, fluorescentStartup: true, faultyStarterLoop: true, startupDelaySeconds: 0 } }));
  prefabs.forEach((prefab) => instances.set(`room:${prefab.name}`, { root: {}, light: { userData: {} } }));
  const config = { levelEnvironments: { room: { prefabs }, foreign: { prefabs: [{ name: targets[0], light: { enabled: true } }] } } };
  const binding = new LevelBindingRuntime({
    config, levelPrefabInstances: instances, playSoundAtObject() {},
    createFixtureFlickerState: () => ({}), createFluorescentStartupPattern: () => [1],
    applyLevelPrefabConfig() {}, updateControlTooltip() {},
  });
  const sync = () => syncLightPanelPower(panel, "room", { config, setLightEnabled: (...args) => binding.setPrefabLightEnabled(...args) });
  sync();
  activateLightPanelControl(parts.get("LightPanel1_Switch_ServiceCooridor1"), instances);
  sync();
  assert.ok(prefabs.filter((prefab) => prefab.name.startsWith("fluorescentLamp_Corridor")).every((prefab) => prefab.light.enabled === false));
  assert.equal(prefabs.find((prefab) => prefab.name === "fluorescentLamp_TutorialCabin").light.enabled, true);
  const master = parts.get("LightPanel1_SwitchIsolator1");
  activateLightPanelControl(master, instances);
  sync();
  assert.ok(prefabs.filter((prefab) => prefab.name !== "unrelated").every((prefab) => prefab.light.enabled === false));
  activateLightPanelControl(master, instances);
  sync();
  assert.ok(prefabs.filter((prefab) => prefab.name !== "unrelated").every((prefab) => prefab.light.enabled && !prefab.light.faultyStarterLoop));
  assert.deepEqual(instances.get(`room:${targets[0]}`).startupPattern, [1]);
  assert.equal(prefabs.find((prefab) => prefab.name === "unrelated").light.enabled, true);
  assert.equal(config.levelEnvironments.foreign.prefabs[0].light.enabled, true);
  binding.setPrefabLightEnabled("room", targets[0], false);
  sync();
  assert.equal(panel.config.circuits.ControlBooth.enabled, true);
  assert.equal(prefabs.find((prefab) => prefab.name === targets[0]).light.enabled, false);
  binding.setPrefabLightEnabled("room", targets[0], true);
  sync();
  assert.equal(panel.config.circuits.ControlBooth.enabled, true);
});

test("artist tuning exposes, applies and round-trips controller state and circuit bindings", async () => {
  const { prefab, panel, parts } = await fixture();
  const tuning = getLightPanelDebugProperties(prefab);
  assert.equal(tuning, prefab.lightPanel);
  tuning.doorClosedDegrees = -70;
  tuning.switchOffDegrees = 22;
  tuning.masterOnPosition = 0.13;
  tuning.startsOpen = true;
  tuning.circuits.StaffRoom.targets = "futureLamp";
  applyLightPanelConfig(panel, tuning);
  assert.equal(panel.door.open, true);
  updateLightPanelRuntime(panel, 1);
  assert.equal(parts.get("LightPanel1_SwitchIsolator1").position.y, 0.13);
  const snapshot = createLevelOverrideSnapshot({ prefabs: [prefab] });
  const restored = createPrefabInstance("LightPanel1", { name: prefab.name });
  applyPrefabOverrideEntries([restored], snapshot.prefabs);
  assert.equal(restored.lightPanel.switchOffDegrees, 22);
  assert.equal(restored.lightPanel.circuits.StaffRoom.targets, "futureLamp");
  assert.equal(snapshot.prefabs[0].behavior, undefined);
});

test("every bound lamp exists in the interior export including staff and power halls", async () => {
  const { panel } = await fixture();
  const bytes = readFileSync(new URL("../assets/mesh/environment/SM_Interior2.glb", import.meta.url));
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const names = new Set(json.nodes.map((node) => node.name));
  for (const target of Object.values(panel.config.circuits).flatMap((circuit) => [circuit.targets, circuit.extraTargets].join(",").split(",").map((name) => name.trim()).filter(Boolean))) {
    assert.ok(names.has(`PF_${target}`), `Missing lamp marker: ${target}`);
  }
  assert.match(panel.config.circuits.StaffRoom.targets, /StaffRoom1/);
  assert.match(panel.config.circuits.ServiceOther.targets, /PowerHall1/);
});

test("missing cabinet controls fail loudly", () => {
  const prefab = createPrefabInstance("LightPanel1", { name: "BadPanel" });
  assert.throws(() => createLightPanelRuntime(new Map(), prefab.lightPanel, prefab.name), /Missing mesh.*BadPanel/);
});

test("tripped breakers blink red, block room buttons, and require an isolator cycle", async () => {
  const { panel, parts, instances } = await fixture({ tripped: true });
  const lamp = { name: "fluorescentLamp_TutorialCabin", light: { enabled: true, faultyStarterLoop: true } };
  instances.set(`room:${lamp.name}`, { root: {}, light: { userData: {} } });
  const config = { levelEnvironments: { room: { prefabs: [lamp] } } };
  const binding = new LevelBindingRuntime({
    config, levelPrefabInstances: instances, getLevelEnvironmentId: (id) => id,
    playSoundAtObject() {}, createFixtureFlickerState: () => ({}),
    createFluorescentStartupPattern: () => [1], applyLevelPrefabConfig() {}, updateControlTooltip() {},
  });
  const sync = () => syncLightPanelPower(panel, "room", { config, setLightEnabled: (...args) => binding.setPrefabLightEnabled(...args) });
  sync();
  assert.equal(lamp.light.enabled, false);
  const button = { action: "togglePrefabLight", target: lamp.name };
  assert.equal(binding.execute(button, "room"), false);
  const indicator = parts.get("LightPanel1_SwitchLight_ControlBooth").material;
  assert.equal(indicator.emissive.getHexString(), "ff2222");
  assert.equal(indicator.emissiveIntensity, panel.config.indicatorIntensity);
  updateLightPanelRuntime(panel, panel.config.faultBlinkSeconds * 0.6);
  assert.equal(indicator.emissiveIntensity, 0);
  const breaker = parts.get("LightPanel1_Switch_ControlBooth");
  activateLightPanelControl(breaker, instances);
  activateLightPanelControl(breaker, instances);
  sync();
  assert.equal(lamp.light.enabled, false);
  const master = parts.get("LightPanel1_SwitchIsolator1");
  activateLightPanelControl(master, instances);
  sync();
  assert.equal(binding.execute(button, "room"), false);
  activateLightPanelControl(master, instances);
  sync();
  updateLightPanelRuntime(panel, 0);
  assert.equal(lamp.light.enabled, true);
  assert.equal(lamp.light.faultyStarterLoop, false);
  assert.equal(indicator.emissive.getHexString(), "72ff91");
  applyLightPanelConfig(panel, panel.config);
  assert.equal(panel.circuits.get("ControlBooth").tripped, false);
  activateLightPanelControl(breaker, instances);
  sync();
  assert.equal(binding.execute(button, "room"), false);
  assert.equal(lamp.light.enabled, false);
});

test("saved on states cannot override the level's initial power failure", () => {
  const panel = createPrefabInstance("LightPanel1", { name: "panel" });
  const lamp = createPrefabInstance("fluorescentLamp", { name: "fluorescentLamp_TutorialCabin" });
  const desk = createPrefabInstance("LampDesk1", { name: "LampDesk1_1" });
  const dome = createPrefabInstance("LampDome1", { name: "LampDome1_EntHall1" });
  applyPrefabStatePolicies([panel, lamp, desk, dome], LEVEL_EXPLORING_AROUND_CONFIG.prefabStatePolicies);
  assert.equal(panel.lightPanel.startsTripped, true);
  assert.equal(lamp.light.enabled, false);
  assert.equal(desk.light.enabled, false);
  assert.equal(dome.light.enabled, false);
});

test("level-authored circuit defaults allow saved bindings to win when a marker is loaded", async () => {
  const { applyLevelOverrides } = await import("../src/levels/LevelConfigOverrides.js");
  const config = {
    assetPath: "level.glb", collisionAssetPath: "level.glb", prefabs: [],
    prefabStatePolicies: LEVEL_EXPLORING_AROUND_CONFIG.prefabStatePolicies,
  };
  applyLevelOverrides(config, { prefabs: [{ name: "LightPanel1_Main", lightPanel: { circuits: { ControlBooth: { targets: "replacementLamp" } } } }] });
  const builder = createLevelSceneBuilder({
    scene: new THREE.Scene(), collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    isCollisionVisible: () => false, registerEnvironmentObject() {},
    registerPrefabInteraction() {}, applyPrefabConfig() {}, appendPanelPhysics() {},
    environmentModels: new Map(), collisionModels: new Map(), prefabInstances: new Map(),
    createPrefabRuntime: (root) => ({ root, ready: Promise.resolve() }),
    loadSceneAsset: async (path) => {
      const root = new THREE.Group();
      if (path === "level.glb") {
        const marker = new THREE.Object3D();
        marker.name = "PF_LightPanel1_Main";
        root.add(marker);
      }
      return root;
    },
  });
  await builder.build({}, "room", config);
  const circuits = config.prefabs.find((prefab) => prefab.name === "LightPanel1_Main").lightPanel.circuits;
  assert.equal(circuits.ControlBooth.targets, "replacementLamp");
  assert.equal(circuits.Observation.targets, "fluorescentLamp_Observation1");
});
