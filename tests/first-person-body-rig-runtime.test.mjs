import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { FirstPersonBodyRigRuntime } from "../src/player/FirstPersonBodyRigRuntime.js";

function advance(rig, frames, input) {
  let snapshot;
  for (let index = 0; index < frames; index += 1) {
    snapshot = rig.update({
      dt: 1 / 60,
      headYaw: 0,
      actualDelta: new THREE.Vector3(),
      groundedBefore: true,
      groundedAfter: true,
      verticalVelocityBefore: 0,
      ...input,
    });
  }
  return snapshot;
}

test("gait phase and support leg advance only from real grounded distance", () => {
  const rig = new FirstPersonBodyRigRuntime();
  advance(rig, 120, { actualDelta: new THREE.Vector3() });
  assert.equal(rig.snapshot.stepCount, 0);
  assert.equal(rig.snapshot.supportLeg, "left");

  advance(rig, 40, { actualDelta: new THREE.Vector3(0, 0, -0.02) });
  assert.equal(rig.snapshot.stepCount, 1);
  assert.equal(rig.snapshot.supportLeg, "right");
});

test("the stabilized camera receives much less body motion than held equipment", () => {
  const rig = new FirstPersonBodyRigRuntime();
  const snapshot = advance(rig, 18, { actualDelta: new THREE.Vector3(0.012, 0, -0.02) });
  const cameraMotion = Math.hypot(snapshot.camera.side, snapshot.camera.vertical, snapshot.camera.forward);
  const heldMotion = Math.hypot(snapshot.held.side, snapshot.held.vertical, snapshot.held.forward);
  assert.ok(cameraMotion > 0);
  assert.ok(heldMotion > cameraMotion * 1.5);
});

test("a large stationary head turn causes body follow and a foot reposition", () => {
  const rig = new FirstPersonBodyRigRuntime();
  const snapshot = advance(rig, 90, { headYaw: THREE.MathUtils.degToRad(70) });
  assert.ok(snapshot.bodyYaw > THREE.MathUtils.degToRad(8));
  assert.ok(Math.abs(snapshot.headRelativeYaw) <= THREE.MathUtils.degToRad(35));
  assert.ok(snapshot.stepCount > 0);
});

test("crouch, step height and landing feed separate recovery springs", () => {
  const rig = new FirstPersonBodyRigRuntime();
  rig.onStanceChanged({ eyeHeightDelta: 0.68, crouched: true });
  let snapshot = advance(rig, 1, {});
  assert.ok(snapshot.camera.vertical > 0);
  assert.ok(snapshot.camera.forward > 0);

  snapshot = advance(rig, 1, { actualDelta: new THREE.Vector3(0, 0.08, 0) });
  assert.ok(snapshot.camera.vertical < 0.68);
  snapshot = advance(rig, 1, {
    groundedBefore: false,
    groundedAfter: true,
    verticalVelocityBefore: -4,
  });
  assert.ok(snapshot.held.vertical < 0);
});

test("physical strafing transfers weight through an underdamped roll and lateral spring", () => {
  const rig = new FirstPersonBodyRigRuntime();
  let snapshot = advance(rig, 90, { actualDelta: new THREE.Vector3(1.65 / 60, 0, 0) });
  assert.ok(snapshot.components.strafe.side > 0.013);
  assert.ok(snapshot.components.strafe.roll < -THREE.MathUtils.degToRad(1.25));

  let maximumOppositeSide = 0;
  for (let index = 0; index < 90; index += 1) {
    snapshot = advance(rig, 1, { actualDelta: new THREE.Vector3(-1.65 / 60, 0, 0) });
    maximumOppositeSide = Math.min(maximumOppositeSide, snapshot.components.strafe.side);
  }
  assert.ok(maximumOppositeSide < -0.015);
  assert.ok(snapshot.components.strafe.roll > THREE.MathUtils.degToRad(1.25));
});

test("starting and stopping resolved forward motion moves head weight in opposite directions", () => {
  const rig = new FirstPersonBodyRigRuntime();
  let snapshot = advance(rig, 3, { actualDelta: new THREE.Vector3(0, 0, -1.4 / 60) });
  assert.ok(snapshot.components.forwardWeight < 0);
  advance(rig, 45, { actualDelta: new THREE.Vector3(0, 0, -1.4 / 60) });
  snapshot = advance(rig, 3, { actualDelta: new THREE.Vector3() });
  assert.ok(snapshot.components.forwardWeight > 0);
});

test("direct look deltas drive a separate angular reaction with recovery overshoot", () => {
  const rig = new FirstPersonBodyRigRuntime();
  rig.addLookDelta({ yaw: 0.12, pitch: 0.07 });
  let snapshot = advance(rig, 1, {});
  const initialRoll = snapshot.components.look.roll;
  const initialPitch = snapshot.components.look.pitch;
  assert.ok(initialRoll < 0);
  assert.ok(initialPitch < 0);

  let crossedRollCenter = false;
  let crossedPitchCenter = false;
  for (let index = 0; index < 90; index += 1) {
    snapshot = advance(rig, 1, {});
    crossedRollCenter ||= snapshot.components.look.roll > 0;
    crossedPitchCenter ||= snapshot.components.look.pitch > 0;
  }
  assert.equal(crossedRollCenter, true);
  assert.equal(crossedPitchCenter, true);
});

test("authored gait reaches visible human weight-transfer ranges without a continuous sine", () => {
  const rig = new FirstPersonBodyRigRuntime();
  const ranges = { vertical: 0, side: 0, roll: 0, pitch: 0 };
  const supports = new Set();
  for (let index = 0; index < 180; index += 1) {
    const snapshot = advance(rig, 1, { actualDelta: new THREE.Vector3(0, 0, -1.65 / 60) });
    supports.add(snapshot.supportLeg);
    ranges.vertical = Math.max(ranges.vertical, Math.abs(snapshot.components.gait.cameraVertical));
    ranges.side = Math.max(ranges.side, Math.abs(snapshot.components.gait.cameraSide));
    ranges.roll = Math.max(ranges.roll, Math.abs(snapshot.components.gait.cameraRoll));
    ranges.pitch = Math.max(ranges.pitch, Math.abs(snapshot.components.gait.cameraPitch));
  }
  assert.deepEqual([...supports].sort(), ["left", "right"]);
  assert.ok(ranges.vertical > 0.012);
  assert.ok(ranges.side > 0.01);
  assert.ok(ranges.roll > THREE.MathUtils.degToRad(0.6));
  assert.ok(ranges.pitch > THREE.MathUtils.degToRad(0.4));
});
