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
