import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { Capsule } from "three/addons/math/Capsule.js";
import { PlayerCollisionDebugRuntime } from "../src/player/PlayerCollisionDebugRuntime.js";

test("player collision debug runtime owns capsule, step and lean visualization", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(3, 4, 5);
  const capsule = new Capsule(new THREE.Vector3(1, 1, 2), new THREE.Vector3(1, 2, 2), 0.3);
  const runtime = new PlayerCollisionDebugRuntime({
    scene,
    capsule,
    camera,
    config: { show: true, stepHeight: 0.4 },
    getCameraRadius: () => 0.12,
  });

  runtime.update();

  assert.equal(scene.getObjectByName("PlayerCollisionDebug"), runtime.views.group);
  assert.deepEqual(runtime.views.bottom.position.toArray(), [1, 1, 2]);
  assert.deepEqual(runtime.views.body.position.toArray(), [1, 1.5, 2]);
  assert.deepEqual(runtime.views.step.scale.toArray(), [0.405, 0.4, 0.405]);
  assert.deepEqual(runtime.views.lean.position.toArray(), [3, 4, 5]);
  assert.deepEqual(runtime.views.lean.scale.toArray(), [0.12, 0.12, 0.12]);

  runtime.setVisible(false);
  assert.equal(runtime.views.group.visible, false);
});
