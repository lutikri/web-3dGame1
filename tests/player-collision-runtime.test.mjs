import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createPlayerCollisionRuntime } from "../src/player/PlayerCollisionRuntime.js";

function createCapsule(radius = 0.25) {
  return {
    radius,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    translate(offset) {
      this.start.add(offset);
      this.end.add(offset);
    },
  };
}

test("player collision runtime synchronizes capsule from eye position", () => {
  const playerPosition = new THREE.Vector3(2, 1.8, 3);
  const capsule = createCapsule();
  const runtime = createPlayerCollisionRuntime({
    config: { playerEyeHeight: 1.6, player: { collision: {} } },
    playerPosition,
    playerCapsule: capsule,
    camera: { position: new THREE.Vector3() },
    cameraCollisionCapsule: createCapsule(),
    movementVelocity: new THREE.Vector3(),
    getPhysicsSystem: () => null,
    getPhysicsSceneKey: () => "default",
    getCollisionOctree: () => ({ capsuleIntersect: () => null }),
    isCollisionReady: () => false,
    getPlayerRadius: () => 0.25,
    getPlayerHeight: () => 1.7,
    getCameraRadius: () => 0.1,
  });

  runtime.syncCapsule();
  assert.deepEqual([capsule.start.x, capsule.start.z], [2, 3]);
  assert.ok(Math.abs(capsule.start.y - 0.45) < 1e-9);
  assert.deepEqual([capsule.end.x, capsule.end.z], [2, 3]);
  assert.ok(Math.abs(capsule.end.y - 1.65) < 1e-9);
});

test("player collision runtime prefers the active physics character", () => {
  const playerPosition = new THREE.Vector3();
  const capsule = createCapsule();
  const physics = {
    hasCharacter: () => true,
    hasScene: (key) => key === "level-a",
    moveCharacter: () => new THREE.Vector3(4, 2, 1),
  };
  const runtime = createPlayerCollisionRuntime({
    config: { playerEyeHeight: 1.6, player: { collision: {} } },
    playerPosition,
    playerCapsule: capsule,
    camera: { position: new THREE.Vector3() },
    cameraCollisionCapsule: createCapsule(),
    movementVelocity: new THREE.Vector3(),
    getPhysicsSystem: () => physics,
    getPhysicsSceneKey: () => "level-a",
    getCollisionOctree: () => ({ capsuleIntersect: () => null }),
    isCollisionReady: () => true,
    getPlayerRadius: () => 0.25,
    getPlayerHeight: () => 1.7,
    getCameraRadius: () => 0.1,
  });

  runtime.move(new THREE.Vector3(1, 0, 0));
  assert.deepEqual(playerPosition.toArray(), [4, 2, 1]);
  assert.equal(capsule.start.x, 4);
});

test("player collision runtime reapplies capsule and physics character dimensions", () => {
  const playerPosition = new THREE.Vector3(1, 2, 3);
  const playerCapsule = createCapsule(0.1);
  const cameraCollisionCapsule = createCapsule(0.1);
  let dimensions;
  let characterConfig;
  const runtime = createPlayerCollisionRuntime({
    config: { playerEyeHeight: 1.6, player: { collisionRadius: 0.4, collisionHeight: 1.9, collision: { cameraRadius: 0.2 } } },
    playerPosition, playerCapsule, camera: new THREE.PerspectiveCamera(), cameraCollisionCapsule,
    movementVelocity: new THREE.Vector3(), getPhysicsSystem: () => ({ createCharacter: (value) => { characterConfig = value; } }),
    getPhysicsSceneKey: () => "room", getCollisionOctree: () => ({ capsuleIntersect: () => null }), isCollisionReady: () => false,
    getPlayerRadius: () => dimensions?.radius ?? 0.1, getPlayerHeight: () => dimensions?.height ?? 1.6,
    getCameraRadius: () => dimensions?.cameraRadius ?? 0.1, setDimensions: (value) => { dimensions = value; },
  });
  assert.deepEqual(runtime.applySettings(), { radius: 0.4, height: 1.9, cameraRadius: 0.2 });
  assert.equal(playerCapsule.radius, 0.4);
  assert.equal(cameraCollisionCapsule.radius, 0.2);
  assert.equal(characterConfig.height, 1.9);
});
