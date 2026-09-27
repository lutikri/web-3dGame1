import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  isLevelRigidDescendant,
  isLevelRigidRoot,
  LevelRigidBodyRuntime,
} from "../src/runtime/LevelRigidBodyRuntime.js";

test("level rigid runtime registers authored RB metadata as one physics body and draggable target", () => {
  const environment = new THREE.Group();
  const root = new THREE.Group();
  root.name = "RB_LoosePipe01";
  root.userData = {
    tg_kind: "level_rigid_body",
    tg_rigid_id: "LoosePipe01",
    tg_rigid_mass: 10,
    tg_rigid_draggable: true,
    tg_rigid_persistent: true,
    tg_rigid_friction: 0.6,
  };
  const visual = new THREE.Mesh(new THREE.BoxGeometry());
  visual.name = "SM_LoosePipe";
  const collider = new THREE.Mesh(new THREE.BoxGeometry());
  collider.name = "UBX_LoosePipe01_01";
  collider.userData.tg_kind = "collider";
  root.add(visual, collider);
  environment.add(root);

  const calls = { created: [], removed: [], registered: [], unregistered: [] };
  const runtime = new LevelRigidBodyRuntime({
    physics: {
      createRigidPrefab: (entry) => calls.created.push(entry),
      removeRigidPrefab: (key) => calls.removed.push(key),
    },
    itemInteraction: {
      registerLevelRigidBody: (entry) => calls.registered.push(entry),
      unregisterLevelRigidBody: (id) => calls.unregistered.push(id),
    },
  });

  const entries = runtime.registerLevel("exploring-around", environment);

  assert.equal(entries.length, 1);
  assert.equal(isLevelRigidRoot(root), true);
  assert.equal(isLevelRigidDescendant(collider, environment), true);
  assert.equal(collider.visible, false);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].key, "exploring-around:levelRigid:LoosePipe01");
  assert.equal(calls.created[0].mass, 10);
  assert.deepEqual(calls.created[0].colliderMeshes, [collider]);
  assert.equal(calls.registered[0].target, visual);

  runtime.unregisterLevel("exploring-around");
  assert.deepEqual(calls.removed, ["exploring-around:levelRigid:LoosePipe01"]);
  assert.deepEqual(calls.unregistered, ["exploring-around:levelRigid:LoosePipe01"]);
});

test("level rigid runtime ignores malformed RB roots without creating physics", () => {
  const environment = new THREE.Group();
  const root = new THREE.Group();
  root.name = "RB_NoCollider";
  root.userData = { tg_kind: "level_rigid_body", tg_rigid_id: "NoCollider" };
  root.add(new THREE.Mesh(new THREE.BoxGeometry()));
  environment.add(root);
  const created = [];
  const runtime = new LevelRigidBodyRuntime({ physics: { createRigidPrefab: (entry) => created.push(entry) }, warn: () => {} });

  assert.deepEqual(runtime.registerLevel("exploring-around", environment), []);
  assert.deepEqual(created, []);
});
