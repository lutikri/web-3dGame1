import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { LevelStaticPhysicsRuntime } from "../src/runtime/LevelStaticPhysicsRuntime.js";

test("level static physics runtime composes environment, panel and eligible prefab colliders", () => {
  const calls = [];
  const panel = new THREE.Group();
  const panelCollider = new THREE.Mesh(new THREE.BoxGeometry());
  panel.add(panelCollider);
  panel.updateMatrixWorld(true);
  const staticCollider = new THREE.Mesh(new THREE.BoxGeometry());
  const dynamicCollider = new THREE.Mesh(new THREE.BoxGeometry());
  const prefabRoot = new THREE.Group();
  prefabRoot.add(staticCollider, dynamicCollider);
  const runtime = new LevelStaticPhysicsRuntime({
    config: { levelEnvironments: { room: { prefabs: [{ behavior: "operatorPanel", position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) }] } } },
    levelCollisionModels: new Map([["room", new THREE.Group()]]), panelCollisionMeshes: [panelCollider],
    levelPrefabInstances: new Map([["room:fixture", { root: prefabRoot, collisionMeshes: [staticCollider, dynamicCollider], dynamicColliderMeshes: new Set([dynamicCollider]), staticWhileLockedColliderMeshes: new Set() }]]),
    getPanelModel: () => panel,
    getPhysicsSystem: () => ({ addStaticScene: () => calls.push("base"), appendStaticScene: (_id, root) => calls.push(root.children.length) }),
    applyOperatorPanelLevel: () => calls.push("panel"),
  });
  assert.equal(runtime.rebuild("room"), true);
  assert.deepEqual(calls, ["base", 1, "panel", 1]);
});

test("level static physics runtime ignores a missing environment", () => {
  const runtime = new LevelStaticPhysicsRuntime({ levelCollisionModels: new Map() });
  assert.equal(runtime.rebuild("missing"), false);
});
