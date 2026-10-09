import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  computeLimitedGrabAnchorPosition,
  computeSweepLimitedPosition,
  createPhysicsSystem,
} from "../src/physics/PhysicsSystem.js";

test("grab anchor advances toward the carry point without teleporting", () => {
  const next = computeLimitedGrabAnchorPosition(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0),
    0.1,
    2,
  );

  assert.deepEqual(next.toArray(), [0.2, 0, 0]);
});

test("held objects cannot block or push the player, and dropping restores collision", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const root = new THREE.Group();
  root.position.set(0.6, 0.9, 0);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 2));
  root.add(collider);
  const item = physics.createRigidPrefab({ key: "item", sceneKey: "room", root, colliderMeshes: [collider], density: 1000 });
  const characterSpec = { eyePosition: new THREE.Vector3(0, 1.6, 0), eyeHeight: 1.6, height: 1.8, radius: 0.3, config: {} };
  for (const mode of ["equipped", "grabbed"]) {
    physics.createCharacter(characterSpec);
    physics.setRigidPrefabMode("item", mode);
    physics.world.step();
    const start = { ...item.body.translation() };
    physics.moveCharacter(new THREE.Vector3(1, 0, 0), 1 / 60);
    assert.ok(physics.getCharacter().collider.translation().x > 0.99, mode);
    assert.deepEqual({ ...item.body.translation() }, start);
    assert.ok(Math.abs(item.body.linvel().x) < 1e-6);
  }
  physics.resetRigidPrefab("item");
  physics.releaseRigidPrefab("item");
  physics.createCharacter(characterSpec);
  physics.world.step();
  physics.moveCharacter(new THREE.Vector3(1, 0, 0), 1 / 60);
  assert.ok(physics.getCharacter().collider.translation().x < 0.3);
});

test("cursor ray hits the wall while excluding the player and its flashlight", async () => {
  const physics = await createPhysicsSystem();
  const scene = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1));
  wall.position.set(0, 1.6, -0.7);
  scene.add(wall);
  physics.addStaticScene("room", scene);
  physics.setActiveScene("room");
  physics.createCharacter({ eyePosition: new THREE.Vector3(0, 1.6, 0), eyeHeight: 1.6, height: 1.8, radius: 0.3, config: {} });
  const root = new THREE.Group();
  root.position.set(0, 1.6, -0.4);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  root.add(collider);
  physics.createRigidPrefab({ key: "flashlight", sceneKey: "room", root, colliderMeshes: [collider] });
  physics.setRigidPrefabMode("flashlight", "equipped");
  physics.world.step();
  const hit = physics.raycastWorld(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1), 12, "flashlight");
  assert.ok(Math.abs(hit.z + 0.65) < 1e-6);
  assert.equal(physics.raycastWorld(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 1), 12, "flashlight"), null);
});

test("physical grab drive holds the requested orientation", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const root = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2));
  root.add(collider);
  const prefab = physics.createRigidPrefab({
    key: "room:lamp",
    sceneKey: "room",
    root,
    colliderMeshes: [collider],
    density: 10,
  });
  const targetRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.6, -0.15));

  physics.setRigidPrefabMode("room:lamp", "grabbed");
  assert.equal(physics.driveRigidPrefab(
    "room:lamp",
    new THREE.Vector3(0, 1, -0.7),
    targetRotation,
    { dt: 1 / 60 },
  ), true);

  const rotation = prefab.body.rotation();
  const actual = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
  assert.ok(actual.angleTo(targetRotation) < 1e-3);
  assert.deepEqual({ ...prefab.body.angvel() }, { x: 0, y: 0, z: 0 });
});

test("equipped rigid prefab sweep stops before static walls", async () => {
  const physics = await createPhysicsSystem();
  const wallRoot = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2));
  wall.position.x = 0.5;
  wallRoot.add(wall);
  physics.addStaticScene("test", wallRoot);
  physics.setActiveScene("test");
  physics.world.step();

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  root.add(collider);
  scene.add(root);
  physics.createRigidPrefab({
    key: "test:item",
    sceneKey: "test",
    root,
    colliderMeshes: [collider],
    density: 10,
  });
  physics.setRigidPrefabMode("test:item", "equipped");
  physics.setRigidPrefabPose(
    "test:item",
    new THREE.Vector3(1, 0, 0),
    new THREE.Quaternion(),
    true,
    { sweep: true },
  );
  physics.step(1 / 60);

  assert.ok(root.position.x > 0.2);
  assert.ok(root.position.x < 0.4);
  assert.deepEqual(computeSweepLimitedPosition(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    0.325,
  ).toArray(), [0.325, 0, 0]);
});

test("prismatic prefab part remains dynamic and is limited to its authored travel", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const sceneRoot = new THREE.Group();
  const desk = new THREE.Group();
  const deskCollider = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  desk.add(deskCollider);
  const drawer = new THREE.Group();
  drawer.position.z = -0.5;
  const drawerCollider = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.5));
  drawer.add(drawerCollider);
  desk.add(drawer);
  sceneRoot.add(desk);
  const deskBody = physics.createRigidPrefab({
    key: "desk", sceneKey: "room", root: desk, colliderMeshes: [deskCollider], bodyType: "dynamic",
  });
  const part = physics.createPrismaticPrefabPart({
    key: "drawer", sceneKey: "room", parentKey: "desk", root: drawer,
    colliderMeshes: [drawerCollider], axis: [0, 0, -1], minPosition: 0, maxPosition: 0.45,
  });

  assert.equal(part.body.isDynamic(), true);
  assert.equal(deskBody.body.isDynamic(), true);
  deskBody.body.setGravityScale(0, true);
  part.body.setGravityScale(0, true);
  assert.equal(physics.setPrismaticPrefabPartTarget("drawer", 2), true);
  for (let index = 0; index < 180; index += 1) physics.step(1 / 60);
  const parentPosition = deskBody.body.translation();
  const partPosition = part.body.translation();
  const travel = Math.abs(partPosition.z - parentPosition.z) - 0.5;
  assert.ok(travel > 0.3);
  assert.ok(travel < 0.48);
});

test("releasing an authored fixed rigid prefab applies linear and angular scare velocity", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const root = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2));
  root.add(collider);
  const prefab = physics.createRigidPrefab({
    key: "pipe", sceneKey: "room", root, colliderMeshes: [collider], bodyType: "fixed",
  });

  assert.equal(prefab.body.isFixed(), true);
  assert.equal(physics.releaseRigidPrefab(
    "pipe",
    { x: 0, y: -0.35, z: 0 },
    { x: 1.2, y: 0.4, z: 2.1 },
  ), true);
  assert.equal(prefab.body.isDynamic(), true);
  const linear = prefab.body.linvel();
  const angular = prefab.body.angvel();
  assert.ok(Math.abs(linear.y + 0.35) < 1e-6);
  assert.ok(Math.abs(angular.x - 1.2) < 1e-6);
  assert.ok(Math.abs(angular.y - 0.4) < 1e-6);
  assert.ok(Math.abs(angular.z - 2.1) < 1e-6);

  assert.equal(physics.resetRigidPrefab("pipe"), true);
  assert.equal(prefab.body.isFixed(), true);
  assert.deepEqual({ ...prefab.body.linvel() }, { x: 0, y: 0, z: 0 });
  assert.deepEqual({ ...prefab.body.angvel() }, { x: 0, y: 0, z: 0 });
});

test("out-of-bounds rigid prefabs return to their authored transforms", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const root = new THREE.Group();
  root.position.set(1, 2, 3);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  root.add(collider);
  const prefab = physics.createRigidPrefab({
    key: "room:prop", sceneKey: "room", root, colliderMeshes: [collider], bodyType: "dynamic",
  });
  prefab.body.setTranslation({ x: 8, y: -20, z: 9 }, true);
  prefab.body.setLinvel({ x: 1, y: -5, z: 2 }, true);

  assert.deepEqual(physics.resetOutOfBoundsRigidPrefabs(-8), ["room:prop"]);
  assert.deepEqual({ ...prefab.body.translation() }, { x: 1, y: 2, z: 3 });
  assert.deepEqual({ ...prefab.body.linvel() }, { x: 0, y: 0, z: 0 });
});

test("rigid prefab state round-trips transform, velocity, and sleep state", async () => {
  const physics = await createPhysicsSystem();
  physics.setActiveScene("room");
  const root = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  root.add(collider);
  physics.createRigidPrefab({
    key: "room:persistent-prop", sceneKey: "room", root, colliderMeshes: [collider], bodyType: "dynamic",
  });
  const state = {
    position: { x: 2, y: 3, z: 4 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    linearVelocity: { x: 0.2, y: 0.3, z: 0.4 },
    angularVelocity: { x: 0.5, y: 0.6, z: 0.7 },
    sleeping: false,
  };
  assert.equal(physics.restoreRigidPrefabState("room:persistent-prop", state), true);
  const restored = physics.getRigidPrefabState("room:persistent-prop");
  assert.deepEqual(restored.position, state.position);
  assert.deepEqual(restored.rotation, state.rotation);
  ["x", "y", "z"].forEach((axis) => {
    assert.ok(Math.abs(restored.linearVelocity[axis] - state.linearVelocity[axis]) < 1e-6);
    assert.ok(Math.abs(restored.angularVelocity[axis] - state.angularVelocity[axis]) < 1e-6);
  });
  assert.equal(restored.sleeping, false);
});

test("character stance resizes its Rapier capsule and refuses blocked standing", async () => {
  const physics = await createPhysicsSystem();
  physics.createCharacter({
    eyePosition: new THREE.Vector3(0, 1.6, 0),
    eyeHeight: 1.6,
    height: 1.7,
    radius: 0.25,
    config: {},
  });
  assert.equal(physics.setCharacterDimensions({ height: 1.12, eyeHeight: 0.92 }), true);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1));
  ceiling.position.y = 1.35;
  physics.addStaticScene("stance-room", ceiling);
  physics.setActiveScene("stance-room");
  physics.step(1 / 60);
  assert.equal(physics.setCharacterDimensions({ height: 1.7, eyeHeight: 1.6 }), false);
  physics.unloadScene("stance-room");
  assert.equal(physics.setCharacterDimensions({ height: 1.7, eyeHeight: 1.6 }), true);
});
