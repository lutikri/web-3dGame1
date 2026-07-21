import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createLevelEnvironmentActivation } from "../src/runtime/LevelEnvironmentActivation.js";

test("level activation selects exclusive scene ownership and collision state", () => {
  const activeRoot = new THREE.Group();
  const inactiveRoot = new THREE.Group();
  const collisionRoot = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const calls = [];
  let collisionReady = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  const activation = createLevelEnvironmentActivation({
    config: {
      player: { collision: { show: false } },
      levelEnvironments: { a: { world: { backgroundColor: 0x112233, fogColor: 0x223344, fogNear: 2, fogFar: 1 } } },
    },
    scene,
    resolveEnvironmentId: (id) => id,
    getRequestedLevelId: () => "a",
    getViewMode: () => "level",
    environmentModels: new Map([["a", activeRoot], ["b", inactiveRoot]]),
    collisionModels: new Map([["a", collisionRoot]]),
    prefabInstances: new Map([["a:box", {
      collisionMeshes: [collider], dynamicColliderMeshes: new Set(), staticWhileLockedColliderMeshes: new Set(),
    }]]),
    controlledLights: [], panelCollisionMeshes: [],
    getPanelRuntime: () => ({ applyLevel: (id) => calls.push(`panel:${id}`) }),
    audio: { setActiveLevel: (id) => calls.push(`audio:${id}`) },
    physics: { setActiveScene: (id) => calls.push(`physics:${id}`) },
    getDebugHub: () => null,
    getPanelConfig: () => null,
    setCollisionState: (_octree, ready) => { collisionReady = ready; },
    syncPlayerCapsule: () => calls.push("capsule"),
    resolvePlayerCollisions: () => calls.push("resolve"),
  });
  assert.equal(activation.activate(), "a");
  assert.equal(activeRoot.visible, true);
  assert.equal(inactiveRoot.visible, false);
  assert.equal(collider.visible, false);
  assert.equal(scene.background.getHex(), 0x112233);
  assert.equal(scene.fog.color.getHex(), 0x223344);
  assert.equal(scene.fog.near, 2);
  assert.equal(scene.fog.far, 2.01);
  assert.equal(collisionReady, true);
  assert.ok(calls.includes("physics:a"));
  assert.ok(calls.includes("resolve"));
});
