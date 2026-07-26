import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { MenuCameraRuntime } from "../src/player/MenuCameraRuntime.js";

test("menu camera applies a damped pointer offset around the authored pose", () => {
  const camera = new THREE.PerspectiveCamera();
  const listeners = new Map();
  const eventTarget = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
  };
  const config = {
    camera: {
      menuView: {
        position: new THREE.Vector3(4.4, 0.95, -1.85),
        rotationDegrees: { x: 20.3, y: 55.9, z: 0 },
        pointerLook: { enabled: true, yawDegrees: 1.5, pitchDegrees: 0.8, damping: 100 },
      },
    },
  };
  const runtime = new MenuCameraRuntime({ camera, config, getViewMode: () => "menu", eventTarget });
  runtime.wire();
  listeners.get("pointermove")({ clientX: 1920, clientY: 0 });
  runtime.update(1);

  assert.deepEqual(camera.position.toArray(), [4.4, 0.95, -1.85]);
  assert.ok(THREE.MathUtils.radToDeg(camera.rotation.y) < 55.9);
  assert.ok(THREE.MathUtils.radToDeg(camera.rotation.x) > 20.3);
  runtime.dispose();
  assert.equal(listeners.size, 0);
});
