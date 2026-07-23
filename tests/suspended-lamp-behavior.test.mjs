import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  createSuspendedLampRuntime,
  nudgeSuspendedLampRuntime,
  updateSuspendedLampRuntime,
} from "../src/prefabs/behaviors/SuspendedLampBehavior.js";

test("suspended lamp behavior rotates the authored pivot within its configured limit", () => {
  const pivot = new THREE.Object3D();
  pivot.name = "PIVOT_LampDome1_Suspension";
  const runtime = createSuspendedLampRuntime(new Map([[pivot.name, pivot]]), {
    maxAngleDegrees: 1,
    initialAngleDegrees: 0.5,
    airflowDegrees: 0.2,
  }, "HallLamp");

  for (let index = 0; index < 600; index += 1) updateSuspendedLampRuntime(runtime, 1 / 60);

  const limit = Math.PI / 180 + 1e-9;
  assert.ok(Math.abs(pivot.rotation.x) <= limit);
  assert.ok(Math.abs(pivot.rotation.z) <= limit);
  assert.notEqual(pivot.rotation.x, 0);
});

test("suspended lamp behavior accepts external angular impulses", () => {
  const pivot = new THREE.Object3D();
  const runtime = createSuspendedLampRuntime(new Map([
    ["PIVOT_LampDome1_Suspension", pivot],
  ]), {}, "ImpulseLamp");

  assert.equal(nudgeSuspendedLampRuntime(runtime, 0.1, -0.2), true);
  assert.equal(runtime.velocityX, 0.1);
  assert.equal(runtime.velocityZ, -0.2);
});

test("disabled suspended lamp behavior returns the pivot to its authored rotation", () => {
  const pivot = new THREE.Object3D();
  pivot.rotation.set(0.1, 0.2, 0.3);
  const runtime = createSuspendedLampRuntime(new Map([
    ["PIVOT_LampDome1_Suspension", pivot],
  ]), { enabled: true }, "DisabledLamp");
  updateSuspendedLampRuntime(runtime, 1 / 60);
  runtime.config.enabled = false;
  updateSuspendedLampRuntime(runtime, 1 / 60);

  assert.ok(Math.abs(pivot.rotation.x - 0.1) < 1e-9);
  assert.ok(Math.abs(pivot.rotation.y - 0.2) < 1e-9);
  assert.ok(Math.abs(pivot.rotation.z - 0.3) < 1e-9);
  assert.equal(runtime.velocityX, 0);
  assert.equal(runtime.velocityZ, 0);
});
