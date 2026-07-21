import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { InputLockRuntime } from "../src/player/InputLockRuntime.js";

function createRuntime(calls) {
  return new InputLockRuntime({
    keys: new Set(["KeyW"]), movementVelocity: new THREE.Vector3(1, 2, 3),
    endDoorDrag: () => calls.push("drag"), releaseDoorLatches: () => calls.push("latches"),
    clearHoveredDoor: () => calls.push("door"), exitPointerLock: () => calls.push("pointer"),
    setJumpQueued: (value) => calls.push(["jump", value]), setZoomActive: (value) => calls.push(["zoom", value]),
    releaseControls: () => calls.push("controls"), clearHoveredKnob: () => calls.push("knob"),
    clearHoveredTooltip: () => calls.push("tooltip"),
  });
}

test("input lock runtime owns complete interaction cleanup", () => {
  const calls = [];
  const runtime = createRuntime(calls);
  assert.equal(runtime.setLocked(true), true);
  assert.equal(runtime.isLocked(), true);
  assert.equal(runtime.keys.size, 0);
  assert.deepEqual(runtime.movementVelocity.toArray(), [0, 0, 0]);
  assert.deepEqual(calls, ["drag", "latches", "door", "pointer", ["jump", false], ["zoom", false], "controls", "knob", "tooltip"]);
  assert.equal(runtime.setLocked(false), false);
});

test("input lock runtime temporarily suspends and restores prior state", () => {
  const calls = [];
  const runtime = createRuntime(calls);
  assert.equal(runtime.suspend(), false);
  assert.equal(runtime.isLocked(), true);
  assert.equal(runtime.restore(false), false);
  assert.deepEqual(calls, ["pointer"]);
});
