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
