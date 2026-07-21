import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { BulkheadExitRuntime } from "../src/interactions/BulkheadExitRuntime.js";

function createRuntime() {
  const interactive = [];
  const thoughts = [];
  const shown = [];
  const runtime = new BulkheadExitRuntime({
    config: {
      label: "LOCKED",
      maxInteractionDistance: 2,
      unlockedTurnDegrees: 70,
      unlockHoldSeconds: 1,
      returnSeconds: 0.5,
      turnJerkFrequency: 3,
      turnJerkDegrees: 2,
      lockedAttemptSeconds: 1,
      lockedStopDegrees: 8,
      lockedKnockDegrees: 1,
      rotationAxis: "z",
    },
    interactive,
    applyAxisRotation: (object, axis, angle) => { object.rotation[axis] += angle; },
    playSound: () => {},
    getGameMode: () => "standby",
    emitThought: (id) => thoughts.push(id),
    getResults: () => ({ mode: "complete" }),
    showResults: (snapshot) => shown.push(snapshot),
    refreshTooltip: () => {},
  });
  return { runtime, interactive, thoughts, shown };
}

test("bulkhead exit runtime registers, rejects locked use, and completes held unlock", () => {
  const { runtime, interactive, thoughts, shown } = createRuntime();
  const handle = new THREE.Object3D();
  handle.userData.lastHitDistance = 1;
  runtime.register(handle);

  assert.equal(interactive[0], handle);
  assert.equal(runtime.begin(), true);
  assert.deepEqual(thoughts, ["door-interlocked"]);

  assert.equal(runtime.unlock(), true);
  assert.equal(handle.userData.controlLabel, "HOLD TO OPEN BULKHEAD");
  runtime.begin();
  runtime.update(1);
  assert.equal(runtime.complete, true);
  assert.equal(shown.length, 1);
});

