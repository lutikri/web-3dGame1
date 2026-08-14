import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createOperatorMovementRuntime } from "../src/player/OperatorMovementRuntime.js";

function createRuntime(overrides = {}) {
  let yaw = 0;
  let pitch = 0;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  const keys = overrides.keys ?? new Set();
  const playerPosition = new THREE.Vector3(0, 1.6, 0);
  let eyeHeight = 1.6;
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
        crouchSpeed: 1,
        operatorMovement: { bodyRig: {} },
      },
      playerEyeHeight: 1.6,
      player: { collision: { jumpSpeed: 3 } },
    },
    camera,
    keys,
    playerPosition,
    movementVelocity: new THREE.Vector3(),
    movingPlatformDelta: new THREE.Vector3(),
    worldUp: new THREE.Vector3(0, 1, 0),
    getViewMode: () => overrides.viewMode ?? "level",
    getControlMode: () => "walk",
    getNoclipEnabled: () => false,
    getZoomActive: () => overrides.zoom ?? false,
    getJumpQueued: () => false,
    setJumpQueued: () => {},
    getPhysicsSystem: () => overrides.physics ?? {
      isCharacterGrounded: () => true,
      getCharacterVerticalVelocity: () => 0,
      jump: () => {},
    },
    moveWithCollisions: (delta) => {
      if (overrides.blockMovement) return;
      playerPosition.add(delta);
    },
    syncCapsule: () => {},
    setCrouched: (value) => {
      if (value === false && overrides.blockStanding) return false;
      eyeHeight = value ? 0.92 : 1.6;
      return true;
    },
    getPlayerEyeHeight: () => eyeHeight,
    applyCameraOffset: (offset) => camera.position.add(offset),
    getYaw: () => yaw,
    setYaw: (value) => { yaw = value; },
    getPitch: () => pitch,
    setPitch: (value) => { pitch = value; },
    getBaseFov: () => 70,
  });
  return { runtime, camera, keys, playerPosition, getYaw: () => yaw, getPitch: () => pitch };
}

test("operator movement runtime owns clamped mouse look", () => {
  const { runtime, getYaw, getPitch } = createRuntime();
  runtime.updateLook(10, 1000);
  assert.equal(getYaw(), -0.1);
  assert.ok(Math.abs(getPitch() + Math.PI / 4) < 1e-9);
});

test("mouse look remains immediate while its physical reaction is secondary", () => {
  const { runtime, getYaw } = createRuntime();
  runtime.updateLook(20, -10);
  assert.equal(getYaw(), -0.2);
  assert.equal(runtime.getBodyRigSnapshot().camera.roll, 0);
  runtime.update(1 / 60);
  assert.notEqual(runtime.getBodyRigSnapshot().components.look.roll, 0);
  assert.equal(getYaw(), -0.2);
});

test("operator movement runtime owns camera zoom presentation", () => {
  const { runtime, camera } = createRuntime({ zoom: true });
  runtime.updateZoom(1);
  assert.ok(camera.fov < 41);
  assert.equal(runtime.getLeanAmount(), 0);
});

test("gameplay zoom does not overwrite the authored menu field of view", () => {
  const { runtime, camera } = createRuntime({ viewMode: "menu", zoom: true });
  camera.fov = 55;
  runtime.updateZoom(1);
  assert.equal(camera.fov, 55);
});

test("operator movement runtime owns clamped noclip speed", () => {
  const { runtime } = createRuntime();
  assert.equal(runtime.getNoclipSpeed(), 4);
  assert.equal(runtime.adjustNoclipSpeed(1), 4.5);
  assert.equal(runtime.setNoclipSpeed(99), 5);
  assert.equal(runtime.adjustNoclipSpeed(-20), 1);
});

test("operator movement runtime enters crouch and refuses to stand under an obstruction", () => {
  const keys = new Set(["ControlLeft"]);
  const { runtime } = createRuntime({ keys, blockStanding: true });
  runtime.update(1 / 60);
  assert.equal(runtime.isCrouched(), true);
  keys.delete("ControlLeft");
  runtime.update(1 / 60);
  assert.equal(runtime.isCrouched(), true);
});

test("body rig advances from resolved movement rather than requested input", () => {
  const keys = new Set(["KeyW"]);
  const moving = createRuntime({ keys });
  moving.runtime.update(1 / 30);
  const movingCamera = moving.camera.position.clone();
  const blocked = createRuntime({ keys: new Set(["KeyW"]), blockMovement: true });
  blocked.runtime.update(1 / 30);
  assert.notDeepEqual(movingCamera.toArray(), blocked.camera.position.toArray());
  assert.deepEqual(blocked.camera.position.toArray(), [0, 1.6, 0]);
});

test("running does not add lens effects or change the authored field of view", () => {
  const keys = new Set(["KeyW", "ShiftLeft"]);
  const { runtime, camera } = createRuntime({ keys });
  for (let index = 0; index < 60; index += 1) runtime.update(1 / 60);
  const presentation = runtime.getLocomotionPresentation();
  runtime.updateZoom(1);
  assert.equal("lensStretch" in presentation, false);
  assert.equal("chromaticAberration" in presentation, false);
  assert.ok(Math.abs(camera.fov - 70) < 0.001);
});

test("head yaw stays free before the physical body begins to follow", () => {
  const { runtime } = createRuntime();
  runtime.updateLook(-THREE.MathUtils.degToRad(20) / 0.01, 0);
  for (let index = 0; index < 30; index += 1) runtime.update(1 / 60);
  assert.ok(Math.abs(runtime.getBodyRigSnapshot().bodyYaw) < 0.001);

  runtime.updateLook(-THREE.MathUtils.degToRad(25) / 0.01, 0);
  for (let index = 0; index < 90; index += 1) runtime.update(1 / 60);
  const snapshot = runtime.getBodyRigSnapshot();
  assert.ok(snapshot.bodyYaw > THREE.MathUtils.degToRad(5));
  assert.ok(snapshot.headRelativeYaw <= THREE.MathUtils.degToRad(35));
});

test("walking presentation transfers weight through camera tilt instead of floating", () => {
  const keys = new Set(["KeyW", "KeyA"]);
  const { runtime, camera, playerPosition } = createRuntime({ keys });
  let maximumRoll = 0;
  let maximumVertical = 0;
  for (let index = 0; index < 48; index += 1) {
    runtime.update(1 / 60);
    maximumRoll = Math.max(maximumRoll, Math.abs(camera.rotation.z));
    maximumVertical = Math.max(maximumVertical, Math.abs(camera.position.y - playerPosition.y));
  }
  assert.ok(maximumRoll > THREE.MathUtils.degToRad(0.05));
  assert.ok(maximumVertical > 0.0005);
});

test("held equipment presentation retains a small idle hand tremor", () => {
  const { runtime } = createRuntime();
  for (let index = 0; index < 30; index += 1) runtime.update(1 / 60);
  const presentation = runtime.getLocomotionPresentation();
  assert.notEqual(presentation.equipmentSide, 0);
  assert.notEqual(presentation.equipmentRoll, 0);
});
