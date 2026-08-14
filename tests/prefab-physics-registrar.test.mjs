import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createPrefabPhysicsRegistrar } from "../src/prefabs/PrefabPhysicsRegistrar.js";

test("prefab physics registrar registers rigid colliders by normalized prefixes", () => {
  const calls = [];
  const collider = { name: "UBX_Box" };
  const runtime = {
    root: {}, collisionMeshes: [collider], dynamicColliderMeshes: new Set(),
  };
  const registrar = createPrefabPhysicsRegistrar({
    physics: { createRigidPrefab: (value) => calls.push(value) },
    normalizeName: (value) => value.replace(/[._\-\s]/g, "").toLowerCase(),
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

test("desk drawer registrar creates separate prismatic bodies and toggles their targets", () => {
  const calls = [];
  const sounds = [];
  const interactive = [];
  const root = new THREE.Group();
  const drawer = new THREE.Mesh(new THREE.BoxGeometry());
  drawer.name = "SM_Desk_Drawer1";
  const drawerCollider = new THREE.Mesh(new THREE.BoxGeometry());
  drawerCollider.name = "UBX_SM_Desk1.004_01";
  drawer.add(drawerCollider);
  const deskCollider = new THREE.Mesh(new THREE.BoxGeometry());
  deskCollider.name = "UBX_SM_Desk1_01";
  root.add(drawer, deskCollider);
  const physics = {
    createRigidPrefab: (value) => { calls.push(["desk", value]); return { body: {} }; },
    createPrismaticPrefabPart: (value) => calls.push(["drawer", value]),
    setPrismaticPrefabPartTarget: (...args) => calls.push(["target", args]),
  };
  const runtime = {
    root,
    parts: new Map([[drawer.name, drawer]]),
    collisionMeshes: [drawerCollider, deskCollider],
    dynamicColliderMeshes: new Set(),
  };
  const registrar = createPrefabPhysicsRegistrar({
    physics,
    interactive,
    normalizeName: (value) => value.toLowerCase(),
    getMatchNames: (mesh) => {
      const names = [mesh.name, mesh.geometry?.name].filter(Boolean);
      let current = mesh.parent;
      while (current) {
        if (current.name) names.push(current.name);
        current = current.parent;
      }
      return names;
    },
    playSound: (...args) => sounds.push(args),
  });
  registrar.register("room", {
    name: "Desk",
    behavior: "deskDrawers",
    rigidBody: { enabled: true, colliderNamePrefixes: ["UBX_SM_Desk1_"] },
    drawers: {
      drawerNames: [drawer.name], closedPosition: 0.18349, openPosition: 0.632626,
      axis: [0, 0, -1],
      openSoundKey: "DrawerMetal_Open1", closeSoundKey: "DrawerMetal_Close1",
    },
  }, runtime);

  assert.deepEqual(calls[0][1].colliderMeshes, [deskCollider]);
  assert.deepEqual(calls[1][1].colliderMeshes, [drawerCollider]);
  assert.ok(Math.abs(calls[1][1].maxPosition - 0.449136) < 1e-9);
  assert.equal(interactive[0], drawer);
  assert.equal(drawer.userData.kind, "slidingDrawer");
  assert.equal(registrar.toggleDeskDrawer(drawer), true);
  assert.equal(calls.at(-1)[0], "target");
  assert.equal(calls.at(-1)[1][0], "room:Desk:drawer:1");
  assert.ok(Math.abs(calls.at(-1)[1][1] - 0.449136) < 1e-9);
  assert.equal(sounds.at(-1)[0], drawer);
  assert.equal(sounds.at(-1)[1], "DrawerMetal_Open1");
  assert.equal(registrar.toggleDeskDrawer(drawer), true);
  assert.equal(sounds.at(-1)[1], "DrawerMetal_Close1");
});
