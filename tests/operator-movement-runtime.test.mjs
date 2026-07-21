import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createOperatorMovementRuntime } from "../src/player/OperatorMovementRuntime.js";

function createRuntime(overrides = {}) {
  let yaw = 0;
  let pitch = 0;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  const runtime = createOperatorMovementRuntime({
    config: {
      camera: {
        walkSpeed: 2,
        runSpeed: 4,
        mouseSensitivity: 0.01,
        pitchLimitDegrees: 45,
        zoomFovDegrees: 40,
        zoomDamping: 20,
        noclip: { speed: 4, minSpeed: 1, maxSpeed: 5, wheelStep: 0.5 },
        operatorMovement: {},
      },
      player: { collision: { jumpSpeed: 3 } },
    },
    camera,
    keys: new Set(),
    playerPosition: new THREE.Vector3(),
    movementVelocity: new THREE.Vector3(),
    movingPlatformDelta: new THREE.Vector3(),
    worldUp: new THREE.Vector3(0, 1, 0),
    getViewMode: () => overrides.viewMode ?? "level",
    getControlMode: () => "walk",
    getNoclipEnabled: () => false,
    getZoomActive: () => overrides.zoom ?? false,
    getJumpQueued: () => false,
    setJumpQueued: () => {},
    getPhysicsSystem: () => null,
    moveWithCollisions: () => {},
    syncCapsule: () => {},
    applyCameraOffset: (offset) => camera.position.add(offset),
    getYaw: () => yaw,
    setYaw: (value) => { yaw = value; },
    getPitch: () => pitch,
    setPitch: (value) => { pitch = value; },
    getBaseFov: () => 70,
  });
  return { runtime, camera, getYaw: () => yaw, getPitch: () => pitch };
}

test("operator movement runtime owns clamped mouse look", () => {
  const { runtime, getYaw, getPitch } = createRuntime();
  runtime.updateLook(10, 1000);
  assert.equal(getYaw(), -0.1);
  assert.ok(Math.abs(getPitch() + Math.PI / 4) < 1e-9);
});

test("operator movement runtime owns camera zoom presentation", () => {
  const { runtime, camera } = createRuntime({ zoom: true });
  runtime.updateZoom(1);
  assert.ok(camera.fov < 41);
  assert.equal(runtime.getLeanAmount(), 0);
});

test("operator movement runtime owns clamped noclip speed", () => {
  const { runtime } = createRuntime();
  assert.equal(runtime.getNoclipSpeed(), 4);
  assert.equal(runtime.adjustNoclipSpeed(1), 4.5);
  assert.equal(runtime.setNoclipSpeed(99), 5);
  assert.equal(runtime.adjustNoclipSpeed(-20), 1);
});
