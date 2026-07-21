import assert from "node:assert/strict";
import test from "node:test";

import { createPrefabPhysicsRegistrar } from "../src/prefabs/PrefabPhysicsRegistrar.js";

test("prefab physics registrar registers rigid colliders by normalized prefixes", () => {
  const calls = [];
  const collider = { name: "UBX_Box" };
  const runtime = {
    root: {}, collisionMeshes: [collider], dynamicColliderMeshes: new Set(),
  };
  const registrar = createPrefabPhysicsRegistrar({
    physics: { createRigidPrefab: (value) => calls.push(value) },
    normalizeName: (value) => value.toLowerCase(),
    getMatchNames: (mesh) => [mesh.name],
  });
  registrar.registerRigid("room", {
    name: "crate", rigidBody: { enabled: true, colliderNamePrefixes: ["ubx_"] },
  }, runtime);
  assert.equal(runtime.rigidPrefabKey, "room:crate:rigid");
  assert.equal(runtime.dynamicColliderMeshes.has(collider), true);
  assert.equal(calls[0].sceneKey, "room");
  assert.deepEqual(calls[0].colliderMeshes, [collider]);
});

test("prefab physics registrar creates separate elevator cage and door bodies", () => {
  const calls = [];
  const cageCollider = { name: "CAGE_COLL" };
  const doorCollider = { name: "DOOR_COLL" };
  const runtime = {
    root: {}, elevator: { cage: {}, door: {} }, collisionMeshes: [cageCollider, doorCollider],
  };
  const registrar = createPrefabPhysicsRegistrar({
    physics: { createKinematicPrefab: (value) => calls.push(value) },
    normalizeName: (value) => value.toLowerCase(),
    getMatchNames: (mesh) => [mesh.name],
  });
  registrar.registerElevator("room", { name: "lift", elevator: {
    cageColliderNamePrefixes: ["cage"], doorColliderNamePrefixes: ["door"],
  } }, runtime);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, "room:lift:cage");
  assert.equal(calls[1].key, "room:lift:door");
});

test("prefab physics registrar owns behavior routing and ordinary door registration", () => {
  const calls = [];
  const registrar = createPrefabPhysicsRegistrar({
    physics: null,
    normalizeName: (value) => value,
    getMatchNames: () => [],
    doorInteractions: { register: (...args) => calls.push(args) },
  });
  const config = { name: "door" };
  const runtime = { root: {} };
  registrar.register("room", config, runtime);
  assert.deepEqual(calls, [["room", config, runtime]]);
});
