import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createPrefabInstance } from "../src/prefabs/PrefabRegistry.js";
import { createPrefabPhysicsRegistrar } from "../src/prefabs/PrefabPhysicsRegistrar.js";
import { LevelPrefabUpdateRuntime } from "../src/prefabs/LevelPrefabUpdateRuntime.js";
import { LevelStaticPhysicsRuntime } from "../src/runtime/LevelStaticPhysicsRuntime.js";
import { createPhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { createLightPanelRuntime, activateLightPanelControl } from "../src/prefabs/behaviors/LightPanelBehavior.js";
import { createServiceTerminalRuntime } from "../src/prefabs/behaviors/ServiceTerminalBehavior.js";
import { applyPrefabOverrideEntries } from "../src/levels/LevelConfigOverrides.js";
import { createLevelOverrideSnapshot } from "../src/levels/LevelConfigSerialization.js";

function authoredPrefab(type) {
  const config = createPrefabInstance(type, { name: "fixture" });
  const bytes = readFileSync(new URL(`../${config.assetPath}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  // Box colliders use accessor bounds. Preserve actual GLB transforms and
  // parenting without requiring a browser Draco decoder in these tests.
  const nodes = gltf.nodes.map((node) => {
    let object = new THREE.Object3D();
    if (node.mesh != null) {
      const accessor = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
      const box = new THREE.Box3(new THREE.Vector3().fromArray(accessor.min), new THREE.Vector3().fromArray(accessor.max));
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
      object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    }
    object.name = node.name;
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  gltf.nodes.forEach((node, index) => node.children?.forEach((child) => nodes[index].add(nodes[child])));
  const root = new THREE.Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((index) => root.add(nodes[index]));
  const runtime = {
    root, parts: new Map(nodes.map((node) => [node.name, node])),
    collisionMeshes: nodes.filter((node) => node.isMesh && node.name.startsWith("UBX_")),
    dynamicColliderMeshes: new Set(), staticWhileLockedColliderMeshes: new Set(),
  };
  return { config, runtime };
}

function registrarFor(physics) {
  return createPrefabPhysicsRegistrar({
    physics, normalizeName: (name) => name.toLowerCase(), getMatchNames: (mesh) => [mesh.name],
  });
}

function appendStatic(physics, runtime) {
  return new LevelStaticPhysicsRuntime({
    levelCollisionModels: new Map([["room", new THREE.Group()]]),
    levelPrefabInstances: new Map([["room:fixture", runtime]]),
    getPhysicsSystem: () => physics,
  }).appendPrefabs("room");
}

test("authored panel door collider follows the animated hinge without a stale static copy", async () => {
  const { config, runtime } = authoredPrefab("LightPanel1");
  runtime.lightPanel = createLightPanelRuntime(runtime.parts, config.lightPanel, config.name);
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  let doorBody;
  registrarFor({
    createKinematicPrefab: (args) => { doorBody = physics.createKinematicPrefab(args); },
  }).register("room", config, runtime);
  assert.equal(appendStatic(physics, runtime), 1, "only the case enters static level collision");
  const door = runtime.parts.get(config.lightPanel.doorMeshName);
  const collider = runtime.parts.get("UBX_SM_Lightpanel1_Door1_01");
  assert.equal(collider.parent, door);
  assert.equal(runtime.dynamicColliderMeshes.has(collider), true);
  const before = new THREE.Vector3().copy(doorBody.colliders[0].translation());
  Object.assign(door.userData, { levelPrefabKey: "room:fixture", lightPanelAction: "door" });
  const instances = new Map([["room:fixture", runtime]]);
  activateLightPanelControl(door, instances);
  const updater = new LevelPrefabUpdateRuntime({
    instances, physics, config: { levelEnvironments: { room: { prefabs: [config] } } },
    getDisplayedLevelId: () => "room", isLevelView: () => true, getPlayerPosition: () => new THREE.Vector3(),
  });
  updater.updateBehaviors(config.lightPanel.doorDurationSeconds);
  physics.world.step();
  const expectedCenter = collider.localToWorld(collider.geometry.boundingBox.getCenter(new THREE.Vector3()));
  const actualCenter = new THREE.Vector3().copy(doorBody.colliders[0].translation());
  assert.ok(actualCenter.distanceTo(expectedCenter) < 1e-5);
  assert.ok(actualCenter.distanceTo(before) > 0.1, "the collider actually moves away from the closed door position");
  const rotation = doorBody.body.rotation();
  assert.ok(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).angleTo(door.getWorldQuaternion(new THREE.Quaternion())) < 0.001);
  activateLightPanelControl(door, instances);
  for (let frame = 0; frame < 2; frame += 1) {
    updater.updateBehaviors(config.lightPanel.doorDurationSeconds / 2);
    physics.world.step();
    const center = collider.localToWorld(collider.geometry.boundingBox.getCenter(new THREE.Vector3()));
    assert.ok(new THREE.Vector3().copy(doorBody.colliders[0].translation()).distanceTo(center) < 1e-5);
  }
  assert.ok(new THREE.Vector3().copy(doorBody.colliders[0].translation()).distanceTo(before) < 1e-5);
  physics.setActiveScene("other");
  assert.equal(doorBody.body.isEnabled(), false);
  physics.setActiveScene("room");
  assert.equal(doorBody.body.isEnabled(), true);
  physics.unloadScene("room");
  assert.equal(physics.getStats().kinematicPrefabCount, 0);
  assert.equal(physics.getStats().staticColliderCount, 0);
  physics.world.free();
});

test("moving part colliders are also excluded from a compound rigid prefab body", () => {
  const { config, runtime } = authoredPrefab("LightPanel1");
  config.rigidBody = { enabled: true, bodyType: "fixed" };
  const registered = [];
  registrarFor({
    createKinematicPrefab: () => {}, createRigidPrefab: (args) => registered.push(args),
  }).register("room", config, runtime);
  assert.deepEqual(registered[0].colliderMeshes.map((mesh) => mesh.name), ["UBX_SM_Lightpanel1_Case_01"]);
});

test("moving part ownership survives instance overrides and is omitted from saved tuning", () => {
  const config = createPrefabInstance("LightPanel1", { name: "fixture", overrides: { kinematicParts: [] } });
  applyPrefabOverrideEntries([config], [{ name: "fixture", kinematicParts: [] }]);
  assert.deepEqual(config.kinematicParts, [{ meshName: "SM_Lightpanel1_Door1" }]);
  assert.equal("kinematicParts" in createLevelOverrideSnapshot({ prefabs: [config] }).prefabs[0], false);
});

test("runtime terminal export includes all authored colliders and preserves its camera socket", async () => {
  const { config, runtime } = authoredPrefab("Terminal1");
  const terminal = createServiceTerminalRuntime(runtime.parts, config.serviceTerminal, config.name, {
    createRenderer: () => ({ texture: new THREE.Texture(), setLanguage() {}, dispose() {} }),
  });
  assert.deepEqual(terminal.viewSocket.position.toArray(), [0, 0.4149312973022461, -0.4746732711791992]);
  assert.equal(runtime.collisionMeshes.length, 3);
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  registrarFor(physics).register("room", config, runtime);
  assert.equal(appendStatic(physics, runtime), 3, "static UBX colliders need no explicit prefab physics config");
  assert.equal(physics.getStats().staticColliderCount, 3);
  physics.world.step();
  const collider = runtime.collisionMeshes[0];
  collider.geometry.computeBoundingBox();
  const center = collider.localToWorld(collider.geometry.boundingBox.getCenter(new THREE.Vector3()));
  assert.ok(physics.raycastWorld(center.clone().add(new THREE.Vector3(0, 0, -2)), new THREE.Vector3(0, 0, 1), 4));
  physics.unloadScene("room");
  assert.equal(physics.getStats().staticColliderCount, 0);
  physics.world.free();
});
